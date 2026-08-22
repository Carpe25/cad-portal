import { NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { sql } from "@/lib/db"
import { generatePresignedUploadUrl } from "@/lib/linode-storage"
import { findTaskByIdentifier, canUploadToTask } from "@/lib/task-db"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id: taskIdentifier } = await params
    if (!taskIdentifier) {
      return NextResponse.json({ error: "Task ID is required" }, { status: 400 })
    }

    const task = await findTaskByIdentifier(taskIdentifier)
    if (!task) {
      return NextResponse.json(
        { error: `Task not found for identifier: ${taskIdentifier}` },
        { status: 404 }
      )
    }

    const taskId = task.id

    if (!canUploadToTask(task, session)) {
      return NextResponse.json(
        { error: "Forbidden: You are not authorized to upload files for this task." },
        { status: 403 }
      )
    }

    const body = await request.json().catch(() => ({}))
    const { filename, fileSize, contentType } = body

    if (!filename || typeof filename !== "string") {
      return NextResponse.json({ error: "Filename is required" }, { status: 400 })
    }

    const countRows = await sql`
      SELECT COUNT(*) FROM submissions WHERE task_id = ${taskId}
    `
    const count = Number((countRows[0] as { count: string | number }).count)
    const version = `V${count + 1}`

    const folderParts = [
      task.cd_project_no,
      task.customer_project_no,
      task.sr_no,
      version,
    ].map((s) => (s || "").trim()).filter(Boolean)
    const folderName = folderParts.length > 0 ? folderParts.join("-") : taskId

    const result = await generatePresignedUploadUrl({
      taskId,
      folderName,
      cdProjectNo: task.cd_project_no,
      customerProjectNo: task.customer_project_no,
      category: "cad",
      version,
      filename,
      fileSize: Number(fileSize) || undefined,
      contentType: contentType || undefined,
    })

    return NextResponse.json({
      success: true,
      presignedUrl: result.presignedUrl,
      fileUrl: result.fileUrl,
      key: result.key,
      version: result.version,
      isFallback: result.isFallback || false,
    })
  } catch (error: any) {
    console.error("Error generating presigned URL:", error)
    return NextResponse.json(
      { error: error.message || "Failed to generate presigned upload URL." },
      { status: 400 }
    )
  }
}
