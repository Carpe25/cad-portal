import { NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { sql } from "@/lib/db"
import { uploadTaskFile } from "@/lib/linode-storage"
import fs from "fs"
import path from "path"
import os from "os"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id: taskId } = await params
    if (!taskId) {
      return NextResponse.json({ error: "Task ID is required" }, { status: 400 })
    }

    const taskRows = await sql`
      SELECT id FROM tasks WHERE id = ${taskId}
    `
    if (!taskRows.length) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 })
    }

    // Determine current submission version
    const countRows = await sql`
      SELECT COUNT(*) FROM submissions WHERE task_id = ${taskId}
    `
    const count = Number((countRows[0] as { count: string | number }).count)
    const version = `V${count + 1}`

    const rawFileName = request.headers.get("x-file-name") || "uploaded_cad_file.3dm"
    let fileName = "uploaded_cad_file.3dm"
    try {
      fileName = decodeURIComponent(rawFileName)
    } catch {
      fileName = rawFileName
    }

    const chunkIndex = Number(request.headers.get("x-chunk-index") || "0")
    const totalChunks = Number(request.headers.get("x-total-chunks") || "1")
    const isLastChunk = request.headers.get("x-is-last-chunk") === "true"
    const isLastFile = request.headers.get("x-is-last-file") === "true"

    const arrayBuffer = await request.arrayBuffer()
    const chunkBuffer = Buffer.from(arrayBuffer)

    // Save chunk to temporary directory
    const cleanFileName = fileName.replace(/[^a-zA-Z0-9_.-]/g, "_")
    const tempDir = path.join(os.tmpdir(), "cad-portal-chunks", taskId, cleanFileName)
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true })
    }

    const chunkPath = path.join(tempDir, `chunk_${chunkIndex}.bin`)
    fs.writeFileSync(chunkPath, chunkBuffer)

    let uploadedUrl: string | null = null
    let uploadedKey: string | null = null

    // Assemble and upload to Linode Object Storage when the final chunk of a file arrives
    if (isLastChunk || chunkIndex + 1 >= totalChunks) {
      const chunkFiles: string[] = []
      for (let c = 0; c < totalChunks; c++) {
        const cp = path.join(tempDir, `chunk_${c}.bin`)
        if (fs.existsSync(cp)) {
          chunkFiles.push(cp)
        }
      }

      const fileBuffers = chunkFiles.map((cp) => fs.readFileSync(cp))
      const combinedBuffer = Buffer.concat(fileBuffers)

      const result = await uploadTaskFile({
        taskId,
        category: "cad",
        version,
        buffer: combinedBuffer,
        filename: fileName,
        contentType: request.headers.get("x-file-type") || "application/octet-stream",
      })

      uploadedUrl = result.url
      uploadedKey = result.key

      // Clean up temp chunk files
      try {
        fs.rmSync(tempDir, { recursive: true, force: true })
      } catch (e) {
        console.error("Error removing temp chunk directory:", e)
      }
    }

    // Finalize submission record in Postgres DB if this is the final chunk of the final file
    if (isLastFile && (isLastChunk || chunkIndex + 1 >= totalChunks) && uploadedUrl) {
      await sql`
        INSERT INTO submissions (task_id, version, drive_link, submitted_by, outcome)
        VALUES (${taskId}, ${version}, ${uploadedUrl}, ${session.id}, 'pending')
      `

      await sql`
        UPDATE tasks SET status = 'in_qc_review' WHERE id = ${taskId}
      `
    }

    return NextResponse.json({
      success: true,
      version,
      url: uploadedUrl,
      key: uploadedKey,
    })
  } catch (error: any) {
    console.error("Error in task chunk upload API route:", error)
    return NextResponse.json(
      { error: error.message || "Failed to upload CAD file chunk." },
      { status: 500 }
    )
  }
}
