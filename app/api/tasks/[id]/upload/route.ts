import { NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { sql } from "@/lib/db"
import { extractDriveFolderId, uploadFilesToDriveFolder } from "@/lib/drive"

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

    const contentType = request.headers.get("content-type") || ""

    let validFiles: Array<{ name: string; mimeType: string; buffer: Buffer }> = []
    let isLast = true
    let driveLink = ""

    if (contentType.includes("application/octet-stream")) {
      const rawFileName = request.headers.get("x-file-name")
      const rawFileType = request.headers.get("x-file-type")
      const rawDriveLink = request.headers.get("x-drive-link")
      isLast = request.headers.get("x-is-last") === "true"

      let fileName = "uploaded_file.bin"
      if (rawFileName) {
        try {
          fileName = decodeURIComponent(rawFileName)
        } catch {
          fileName = rawFileName
        }
      }

      let mimeType = "application/octet-stream"
      if (rawFileType) {
        try {
          mimeType = decodeURIComponent(rawFileType)
        } catch {
          mimeType = rawFileType
        }
      }

      if (rawDriveLink) {
        try {
          driveLink = decodeURIComponent(rawDriveLink)
        } catch {
          driveLink = rawDriveLink
        }
      }

      const arrayBuffer = await request.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)

      if (buffer.length > 0) {
        validFiles.push({
          name: fileName,
          mimeType,
          buffer,
        })
      }
    } else if (contentType.includes("application/json")) {
      const body = await request.json()
      const { fileBase64, originalFilename, mimeType, isLast: isLastParam, driveLink: driveLinkParam } = body

      if (fileBase64 && originalFilename) {
        const buffer = Buffer.from(fileBase64, "base64")
        validFiles.push({
          name: originalFilename,
          mimeType: mimeType || "application/octet-stream",
          buffer,
        })
      }
      isLast = isLastParam ?? true
      driveLink = driveLinkParam || ""
    } else {
      let formData: FormData
      try {
        formData = await request.formData()
      } catch (err: any) {
        console.error("Error parsing FormData in upload route:", err)
        return NextResponse.json(
          { error: `Failed to parse upload request: ${err.message || err}` },
          { status: 400 }
        )
      }

      const rawFiles = formData.getAll("files") as File[]
      const rawOriginalFilename = formData.get("originalFilename") as string | null
      let originalFilename: string | null = null
      if (rawOriginalFilename) {
        try {
          originalFilename = decodeURIComponent(rawOriginalFilename)
        } catch {
          originalFilename = rawOriginalFilename
        }
      }

      for (const file of rawFiles) {
        if (file && file.size > 0 && !file.name.startsWith(".")) {
          const arrayBuffer = await file.arrayBuffer()
          validFiles.push({
            name: originalFilename || file.name,
            mimeType: file.type || "application/octet-stream",
            buffer: Buffer.from(arrayBuffer),
          })
        }
      }
      isLast = formData.get("isLast") ? formData.get("isLast") === "true" : true
      driveLink = (formData.get("driveLink") as string) || ""
    }

    const taskRows = await sql`
      SELECT drive_folder_link FROM tasks WHERE id = ${taskId}
    `
    if (!taskRows.length) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 })
    }

    const taskDriveFolderLink = taskRows[0].drive_folder_link as string | null
    if (!driveLink) driveLink = taskDriveFolderLink || ""

    if (taskDriveFolderLink) {
      const folderId = extractDriveFolderId(taskDriveFolderLink)
      if (folderId && validFiles.length > 0) {
        await uploadFilesToDriveFolder(folderId, validFiles)
      }
      driveLink = taskDriveFolderLink
    }

    if (!driveLink.trim()) {
      return NextResponse.json(
        { error: "Drive link or valid CAD files are required for submission." },
        { status: 400 }
      )
    }

    // Only finalize DB submission when isLast is true
    if (isLast) {
      const countRows = await sql`
        SELECT COUNT(*) FROM submissions WHERE task_id = ${taskId}
      `
      const count = Number((countRows[0] as { count: string | number }).count)
      const version = `V${count + 1}`

      await sql`
        INSERT INTO submissions (task_id, version, drive_link, submitted_by, outcome)
        VALUES (${taskId}, ${version}, ${driveLink.trim()}, ${session.id}, 'pending')
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
