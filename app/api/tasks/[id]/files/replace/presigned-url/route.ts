import { NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { generatePresignedReplaceUrl } from "@/lib/linode-storage"
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
    const { key, filename, contentType } = body as {
      key?: string
      filename?: string
      contentType?: string
    }

    if (!key || !key.startsWith("tasks/")) {
      return NextResponse.json({ error: "Invalid file key" }, { status: 400 })
    }

    const result = await generatePresignedReplaceUrl(
      key,
      contentType || undefined
    )

    return NextResponse.json({
      success: true,
      presignedUrl: result.presignedUrl,
      fileUrl: result.fileUrl,
      key,
      filename,
    })
  } catch (error: any) {
    console.error("Error generating replace presigned URL:", error)
    return NextResponse.json(
      { error: error.message || "Failed to generate replace upload URL." },
      { status: 400 }
    )
  }
}
