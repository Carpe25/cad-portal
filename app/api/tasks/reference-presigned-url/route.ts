import { NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { generateReferencePresignedUploadUrl } from "@/lib/linode-storage"

export async function POST(request: Request) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Role check: Only managers, qc, or logged in users can create/edit task reference images
    if (
      !session.roles.includes("manager") &&
      !session.roles.includes("qc") &&
      !session.roles.includes("designer")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const { filename, fileSize, contentType } = body

    if (!filename || typeof filename !== "string") {
      return NextResponse.json({ error: "Filename is required" }, { status: 400 })
    }

    const result = await generateReferencePresignedUploadUrl({
      filename,
      fileSize: Number(fileSize) || undefined,
      contentType: contentType || undefined,
    })

    return NextResponse.json({
      success: true,
      presignedUrl: result.presignedUrl,
      fileUrl: result.fileUrl,
      key: result.key,
      isFallback: result.isFallback || false,
    })
  } catch (error: any) {
    console.error("Error generating reference presigned URL:", error)
    return NextResponse.json(
      { error: error.message || "Failed to generate presigned upload URL." },
      { status: 500 }
    )
  }
}
