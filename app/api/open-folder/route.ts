import { NextResponse } from "next/server"
import { exec } from "child_process"
import os from "os"
import path from "path"

export async function POST(req: Request) {
  try {
    const { path: rawPath } = await req.json()
    if (!rawPath || typeof rawPath !== "string") {
      return NextResponse.json({ error: "Folder path is required" }, { status: 400 })
    }

    const cleanPath = rawPath.trim()

    // Normalize path formatting for Windows Explorer
    let normalizedPath = cleanPath
    if (normalizedPath.startsWith("file:///")) {
      normalizedPath = normalizedPath.replace("file:///", "")
    } else if (normalizedPath.startsWith("file://")) {
      normalizedPath = normalizedPath.replace("file://", "\\\\")
    }

    // Convert forward slashes to backslashes for Windows
    if (os.platform() === "win32") {
      normalizedPath = normalizedPath.replace(/\//g, "\\")
    }

    const platform = os.platform()

    return new Promise<Response>((resolve) => {
      let command = ""
      if (platform === "win32") {
        const escapedPath = normalizedPath.replace(/'/g, "''")
        const folderLeaf = path.basename(normalizedPath) || ""
        const escapedLeaf = folderLeaf.replace(/'/g, "''")

        // Open Explorer AND switch active window focus to File Explorer window
        command = `powershell -NoProfile -ExecutionPolicy Bypass -Command "$p='${escapedPath}'; Start-Process explorer.exe -ArgumentList \\"\`\\"$p\`\\"\\"; $w=New-Object -ComObject WScript.Shell; Start-Sleep -m 250; if('${escapedLeaf}'){ $w.AppActivate('${escapedLeaf}') }"`
      } else if (platform === "darwin") {
        command = `open "${cleanPath}"`
      } else {
        command = `xdg-open "${cleanPath}"`
      }

      exec(command, (error) => {
        if (error && platform !== "win32") {
          console.error("Failed to open folder:", error)
          resolve(
            NextResponse.json(
              { error: "Failed to open folder", details: error.message },
              { status: 500 }
            )
          )
          return
        }

        resolve(
          NextResponse.json({
            success: true,
            message: "Folder opened and brought to focus successfully",
            path: normalizedPath,
          })
        )
      })
    })
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to process open folder request" },
      { status: 500 }
    )
  }
}
