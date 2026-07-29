import { NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { sql } from "@/lib/db"
import {
  extractDriveFolderId,
  uploadFilesToDriveFolder,
  createResumableUploadSession,
  uploadChunkToDriveSession,
} from "@/lib/drive"

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
      SELECT drive_folder_link FROM tasks WHERE id = ${taskId}
    `
    if (!taskRows.length) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 })
    }

    const taskDriveFolderLink = taskRows[0].drive_folder_link as string | null
    if (!taskDriveFolderLink) {
      return NextResponse.json(
        { error: "Task does not have an attached Google Drive folder link." },
        { status: 400 }
      )
    }

    const folderId = extractDriveFolderId(taskDriveFolderLink)
    if (!folderId) {
      return NextResponse.json(
        { error: "Invalid Google Drive folder link on task." },
        { status: 400 }
      )
    }

    const action = request.headers.get("x-action") || ""
    const contentType = request.headers.get("content-type") || ""

    // 1. INITIATE RESUMABLE UPLOAD SESSION
    if (action === "init-session" || (contentType.includes("application/json") && !request.headers.get("x-upload-url"))) {
      let body: any = {}
      try {
        body = await request.json()
      } catch {
        body = {}
      }

      const rawFileName = body.fileName || request.headers.get("x-file-name")
      const rawRelativePath = body.relativePath || request.headers.get("x-relative-path")
      const rawMimeType = body.mimeType || request.headers.get("x-file-type")
      const fileSize = body.fileSize ? Number(body.fileSize) : Number(request.headers.get("x-file-size") || 0)

      let fileName = "uploaded_file.bin"
      if (rawFileName) {
        try { fileName = decodeURIComponent(rawFileName) } catch { fileName = rawFileName }
      }

      let relativePath = fileName
      if (rawRelativePath) {
        try { relativePath = decodeURIComponent(rawRelativePath) } catch { relativePath = rawRelativePath }
      }

      let mimeType = "application/octet-stream"
      if (rawMimeType) {
        try { mimeType = decodeURIComponent(rawMimeType) } catch { mimeType = rawMimeType }
      }

      const sessionResult = await createResumableUploadSession({
        rootFolderId: folderId,
        relativePath,
        fileName,
        mimeType,
        fileSize,
      })

      return NextResponse.json({
        success: true,
        uploadUrl: sessionResult.uploadUrl,
        fileName: sessionResult.fileName,
      })
    }

    // 2. UPLOAD CHUNK TO RESUMABLE SESSION
    const uploadUrlHeader = request.headers.get("x-upload-url")
    if (action === "upload-chunk" || uploadUrlHeader) {
      const rawUploadUrl = uploadUrlHeader || ""
      const uploadUrl = decodeURIComponent(rawUploadUrl)
      const rangeStart = Number(request.headers.get("x-range-start") || 0)
      const rangeEnd = Number(request.headers.get("x-range-end") || 0)
      const totalSize = Number(request.headers.get("x-total-size") || 0)
      const isLast = request.headers.get("x-is-last") === "true"

      const arrayBuffer = await request.arrayBuffer()
      const chunkBuffer = Buffer.from(arrayBuffer)

      const chunkResult = await uploadChunkToDriveSession({
        uploadUrl,
        chunkBuffer,
        rangeStart,
        rangeEnd,
        totalSize,
      })

      // If this was the last chunk of the final file in the submission batch, finalize task & submission record in DB
      if (isLast) {
        const countRows = await sql`
          SELECT COUNT(*) FROM submissions WHERE task_id = ${taskId}
        `
        const count = Number((countRows[0] as { count: string | number }).count)
        const version = `V${count + 1}`

        await sql`
          INSERT INTO submissions (task_id, version, drive_link, submitted_by, outcome)
          VALUES (${taskId}, ${version}, ${taskDriveFolderLink}, ${session.id}, 'pending')
        `

        await sql`
          UPDATE tasks SET status = 'in_qc_review' WHERE id = ${taskId}
        `
      }

      return NextResponse.json({
        success: true,
        status: chunkResult.status,
        fileId: chunkResult.fileId,
      })
    }

    // 3. FALLBACK: Direct small file upload
    let validFiles: Array<{ name: string; relativePath?: string; mimeType: string; buffer: Buffer }> = []
    let isLast = true

    if (contentType.includes("application/octet-stream")) {
      const rawFileName = request.headers.get("x-file-name")
      const rawRelativePath = request.headers.get("x-relative-path")
      const rawFileType = request.headers.get("x-file-type")
      isLast = request.headers.get("x-is-last") === "true"

      let fileName = "uploaded_file.bin"
      if (rawFileName) {
        try { fileName = decodeURIComponent(rawFileName) } catch { fileName = rawFileName }
      }

      let relativePath = fileName
      if (rawRelativePath) {
        try { relativePath = decodeURIComponent(rawRelativePath) } catch { relativePath = rawRelativePath }
      }

      let mimeType = "application/octet-stream"
      if (rawFileType) {
        try { mimeType = decodeURIComponent(rawFileType) } catch { mimeType = rawFileType }
      }

      const arrayBuffer = await request.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)

      if (buffer.length > 0) {
        validFiles.push({
          name: fileName,
          relativePath: relativePath || fileName,
          mimeType,
          buffer,
        })
      }
    }

    if (validFiles.length > 0) {
      await uploadFilesToDriveFolder(folderId, validFiles)
    }

    if (isLast) {
      const countRows = await sql`
        SELECT COUNT(*) FROM submissions WHERE task_id = ${taskId}
      `
      const count = Number((countRows[0] as { count: string | number }).count)
      const version = `V${count + 1}`

      await sql`
        INSERT INTO submissions (task_id, version, drive_link, submitted_by, outcome)
        VALUES (${taskId}, ${version}, ${taskDriveFolderLink}, ${session.id}, 'pending')
      `

      await sql`
        UPDATE tasks SET status = 'in_qc_review' WHERE id = ${taskId}
      `
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Error in task file upload API route:", error)
    return NextResponse.json(
      { error: error.message || "Failed to upload CAD files." },
      { status: 500 }
    )
  }
}

