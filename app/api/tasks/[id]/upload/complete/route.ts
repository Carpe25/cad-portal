import { NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { sql } from "@/lib/db"

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
      SELECT id, assigned_to, status FROM tasks WHERE id = ${taskId}
    `
    if (!taskRows.length) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 })
    }

    const task = taskRows[0] as { id: string; assigned_to: string | null; status: string }
    const isManager = session.roles.includes("manager")
    const isQC = session.roles.includes("qc")
    const isDesigner = session.roles.includes("designer")
    const isAssigned = task.assigned_to === session.id
    const canWork = isDesigner || isQC

    if (!isManager && !isQC && !isAssigned && !(canWork && task.assigned_to === null)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const { fileUrl, version, designerNotes, folderPath } = body

    if (!fileUrl || typeof fileUrl !== "string") {
      return NextResponse.json({ error: "File URL is required" }, { status: 400 })
    }

    // Determine current version if not supplied
    let subVersion = version
    if (!subVersion) {
      const countRows = await sql`
        SELECT COUNT(*) FROM submissions WHERE task_id = ${taskId}
      `
      const count = Number((countRows[0] as { count: string | number }).count)
      subVersion = `V${count + 1}`
    }

    const cleanDesignerNotes = designerNotes ? String(designerNotes).trim() : null
    const cleanFolderPath = folderPath ? String(folderPath).trim() : null

    // Ensure columns exist in DB
    await sql`ALTER TABLE submissions ADD COLUMN IF NOT EXISTS designer_notes TEXT`
    await sql`ALTER TABLE submissions ADD COLUMN IF NOT EXISTS folder_path TEXT`

    // Record submission entry in DB
    await sql`
      INSERT INTO submissions (task_id, version, drive_link, submitted_by, outcome, designer_notes, folder_path)
      VALUES (${taskId}, ${subVersion}, ${fileUrl}, ${session.id}, 'pending', ${cleanDesignerNotes}, ${cleanFolderPath})
    `

    // Update task status to in_qc_review
    await sql`
      UPDATE tasks SET status = 'in_qc_review' WHERE id = ${taskId}
    `

    return NextResponse.json({
      success: true,
      version: subVersion,
      url: fileUrl,
    })
  } catch (error: any) {
    console.error("Error finalizing task upload submission:", error)
    return NextResponse.json(
      { error: error.message || "Failed to finalize task submission." },
      { status: 500 }
    )
  }
}
