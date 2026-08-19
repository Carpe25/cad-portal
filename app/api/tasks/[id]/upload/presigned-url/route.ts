import { NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { sql } from "@/lib/db"
import { generatePresignedUploadUrl } from "@/lib/linode-storage"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 1. Session Authentication
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id: taskId } = await params
    if (!taskId) {
      return NextResponse.json({ error: "Task ID is required" }, { status: 400 })
    }

    // 2. Database Task Existence & RBAC Authorization Check
    const taskRows = await sql`
      SELECT id, assigned_to, status, cd_project_no, customer_project_no, sr_no FROM tasks WHERE id = ${taskId}
    `
    if (!taskRows.length) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 })
    }

    const task = taskRows[0] as {
      id: string
      assigned_to: string | null
      status: string
      cd_project_no: string | null
      customer_project_no: string | null
      sr_no: string | null
    }
    const isManager = session.roles.includes("manager")
    const isQC = session.roles.includes("qc")
    const isDesigner = session.roles.includes("designer")
    const isAssigned = task.assigned_to === session.id
    const canWork = isDesigner || isQC

    if (!isManager && !isQC && !isAssigned && !(canWork && task.assigned_to === null)) {
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

    // 3. Determine current submission version (V1, V2...)
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

    // 4. Generate Presigned URL with security validations & formatted filename
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
