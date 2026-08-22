import { NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import path from "path"
import { logFileReplacement } from "@/lib/file-replacements"
import { findTaskByIdentifier } from "@/lib/task-db"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session || !session.roles.includes("qc")) {
      return NextResponse.json({ error: "Only QC users can replace files" }, { status: 403 })
    }

    const { id: taskIdentifier } = await params
    const task = await findTaskByIdentifier(taskIdentifier)
    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 })
    }

    const body = await request.json().catch(() => ({}))
    const { key, newFilename } = body as { key?: string; newFilename?: string }

    if (!key || !key.startsWith("tasks/")) {
      return NextResponse.json({ error: "Invalid file key" }, { status: 400 })
    }

    const oldFilename = path.basename(key)
    const replacementName = newFilename?.trim() || oldFilename

    await logFileReplacement({
      taskId: task.id,
      fileKey: key,
      oldFilename,
      newFilename: replacementName,
      replacedBy: session.id,
    })

    return NextResponse.json({
      success: true,
      message: `File replaced by ${session.name}`,
    })
  } catch (error: any) {
    console.error("Error completing file replacement:", error)
    return NextResponse.json(
      { error: error.message || "Failed to complete file replacement." },
      { status: 500 }
    )
  }
}
