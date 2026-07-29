import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate user session
    const session = await getSession()
    if (
      !session ||
      (!session.roles.includes("manager") && !session.roles.includes("qc"))
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // 2. Parse form data
    let formData: FormData
    try {
      formData = await request.formData()
    } catch (err: any) {
      console.error("Error parsing FormData in parse-pdf route:", err)
      return NextResponse.json(
        { error: `Failed to parse PDF upload body: ${err.message || err}` },
        { status: 400 }
      )
    }
    const file = formData.get("file") as File | null
    if (!file) {
      return NextResponse.json({ error: "No PDF file uploaded" }, { status: 400 })
    }

    // 3. Extract text from PDF buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    let pdfText = ""
    try {
      // Dynamic import to prevent next.js bundler from trying to load pdf-parse in non-node envs
      // @ts-ignore
      const pdfImport = await import("pdf-parse/lib/pdf-parse.js")
      // @ts-ignore
      const pdfParse = pdfImport.default || pdfImport
      const data = await pdfParse(buffer)
      pdfText = data.text
    } catch (parseError: any) {
      console.error("PDF Parsing error:", parseError)
      return NextResponse.json(
        { error: `Failed to extract text from PDF: ${parseError.message || parseError}` },
        { status: 500 }
      )
    }

    if (!pdfText || !pdfText.trim()) {
      return NextResponse.json(
        { error: "No text could be extracted from the uploaded PDF file." },
        { status: 422 }
      )
    }

    // 4. Check Cloudflare environment variables
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID
    const apiToken = process.env.CLOUDFLARE_API_TOKEN
    if (!accountId || !apiToken) {
      return NextResponse.json(
        {
          error:
            "Cloudflare API credentials are not configured on the server. Please define CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN in your environment variables.",
        },
        { status: 500 }
      )
    }

    // 5. Query Cloudflare Workers AI
    const model = process.env.CLOUDFLARE_AI_MODEL || "@cf/meta/llama-3.1-8b-instruct"
    const cfUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`

    const systemPrompt = `You are a highly precise Trello card data parser. Your task is to extract information from a text representation of a Trello card PDF and return it as a structured JSON object that conforms EXACTLY to the following TypeScript interface:

interface TrelloLabel {
  id: string;
  name: string;
  color: string;
}

interface TrelloMember {
  id: string;
  fullName: string;
  username: string;
  avatarUrl?: string | null;
}

interface TrelloCheckItem {
  id: string;
  name: string;
  state: string; // "complete" or "incomplete"
}

interface TrelloChecklist {
  id: string;
  name: string;
  checkItems: TrelloCheckItem[];
}

interface TrelloCustomField {
  id: string;
  fieldName: string;
  fieldType: string;
  value: string | null;
}

interface TrelloAttachment {
  id: string;
  name: string;
  url: string;
  date: string;
}

interface ParsedTrelloCard {
  id: string;
  name: string;
  desc: string;
  due: string | null; // Format: YYYY-MM-DD or null
  dueComplete: boolean;
  dateLastActivity: string | null;
  closed: boolean;
  url: string;
  shortUrl: string;
  labels: TrelloLabel[];
  boardName: string | null;
  listName: string | null;
  members: TrelloMember[];
  checklists: TrelloChecklist[];
  customFields: TrelloCustomField[];
  attachments: TrelloAttachment[];
}

Instructions for parsing:
1. **Title / Name**: Extract the main title of the card, which is often at the top of the text (e.g. "P26826 - Ace of Diamonds - sadir").
2. **ID**: Extract the card/project code from the title (e.g., "P26826"). If none, generate a short unique string.
3. **Description**: Extract the full text under the "Description" header.
4. **Custom Fields**: Find custom fields listed in the card (e.g., "Project: Ring", "Size: 6", "Primary Metal: WG", "Points", "Secondary Metal", "Tertiary Metal", "Dispatch date", etc.). Map them to the customFields array. FieldName should be the field name (e.g., "Primary Metal"), fieldType can be "text", "number", "dropdown", or "date", and value should be the actual selected value (e.g., "WG", "6"). If a field's value is "Select..." or not set, set the value to null.
5. **Members**: Extract assigned members from the text (e.g. "SURAJ SINGH").
6. **Checklists**: Extract any checklist sections (e.g. lists of items and check item checkboxes with status "complete" or "incomplete").
7. **Attachments**: Extract filenames under "Attachments" list (e.g., image.png). Map url to an empty string if not found, and date to current date or mentioned date.
8. **Due / Dispatch date**: Under Custom Fields there might be "Dispatch date" (e.g., "Add date..."). Map this to the due field (format YYYY-MM-DD) if it is a valid date, otherwise keep it null.

CRITICAL: Return ONLY a valid, raw JSON object. Do not wrap it in markdown code blocks, do not include any backticks or 'json' headers, and do not include any explanatory text. Your output must be a single parseable JSON block.`

    const cfResponse = await fetch(cfUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: pdfText },
        ],
        max_tokens: 2048,
      }),
    })

    if (!cfResponse.ok) {
      const errorText = await cfResponse.text()
      console.error("Cloudflare Workers AI HTTP Error:", cfResponse.status, errorText)
      return NextResponse.json(
        { error: `Cloudflare AI Gateway returned an HTTP error: ${cfResponse.statusText} (${cfResponse.status})` },
        { status: 500 }
      )
    }

    const aiResult = await cfResponse.json()
    if (!aiResult.success) {
      console.error("Cloudflare Workers AI success=false:", aiResult.errors)
      return NextResponse.json(
        { error: `Cloudflare Workers AI execution failed: ${JSON.stringify(aiResult.errors)}` },
        { status: 500 }
      )
    }

    let aiText = aiResult.result?.response || ""
    aiText = aiText.trim()

    // Clean up code blocks if present
    if (aiText.startsWith("```")) {
      aiText = aiText.replace(/^```(?:json)?\n?/, "")
      aiText = aiText.replace(/\n?```$/, "")
    }
    aiText = aiText.trim()

    try {
      const parsedData = JSON.parse(aiText)
      return NextResponse.json(parsedData)
    } catch (parseError: any) {
      console.error("Failed to parse Cloudflare Workers AI response as JSON:", aiText, parseError)
      return NextResponse.json(
        {
          error: `The AI response was not in a valid JSON format: ${parseError.message}`,
          rawResponse: aiText,
        },
        { status: 500 }
      )
    }
  } catch (error: any) {
    console.error("API parse-pdf internal error:", error)
    return NextResponse.json(
      { error: `An internal server error occurred: ${error.message || error}` },
      { status: 500 }
    )
  }
}
