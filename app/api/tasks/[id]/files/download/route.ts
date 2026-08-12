import { NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { getTaskFileStream } from "@/lib/linode-storage"
import path from "path"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id: taskId } = await params
    const { searchParams } = new URL(request.url)
    const key = searchParams.get("key")

    if (!key) {
      return NextResponse.json({ error: "File key is required" }, { status: 400 })
    }

    // Security check: Ensure requested key belongs to this task's folder
    if (!key.startsWith(`tasks/${taskId}/`)) {
      return NextResponse.json(
        { error: "Access denied to requested file path." },
        { status: 403 }
      )
    }

    const { stream, contentType, contentLength } = await getTaskFileStream(key)
    const filename = path.basename(key)

    const headers = new Headers()
    headers.set("Content-Type", contentType || "application/octet-stream")
    headers.set(
      "Content-Disposition",
      `attachment; filename="${encodeURIComponent(filename)}"`
    )
    if (contentLength) {
      headers.set("Content-Length", contentLength.toString())
    }

    return new NextResponse(stream as any, {
      headers,
    })
  } catch (error: any) {
    console.error("Error streaming file from Linode storage:", error)
    return NextResponse.json(
      { error: error.message || "Failed to download file." },
      { status: 500 }
    )
  }
}
