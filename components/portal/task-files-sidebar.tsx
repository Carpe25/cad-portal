"use client"

import { useState } from "react"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Folder,
  FolderOpen,
  ChevronDown,
  ChevronRight,
  Download,
  FileCode,
  FileText,
  Image as ImageIcon,
  File as FileIcon,
  Eye,
  Music,
  Film,
} from "lucide-react"
import { getMediaKind, canPreviewMedia } from "@/lib/media-utils"
import { useRouter } from "next/navigation"

export type TaskFileItem = {
  key: string
  filename: string
  size: number
  lastModified?: Date | string
  url: string
}

type Props = {
  taskId: string
  linodeFolderName: string
  files: TaskFileItem[]
  isQC?: boolean
}

type GroupedFile = TaskFileItem & {
  cleanFilename: string
  subPath?: string
}

type GroupedFolder = {
  folderName: string
  files: GroupedFile[]
}

type PreviewState = {
  filename: string
  previewUrl: string
  kind: "image" | "video" | "audio"
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function getFileIcon(filename: string) {
  const kind = getMediaKind(filename)
  if (kind === "image") return <ImageIcon className="h-4 w-4 text-emerald-500 shrink-0" />
  if (kind === "video") return <Film className="h-4 w-4 text-violet-500 shrink-0" />
  if (kind === "audio") return <Music className="h-4 w-4 text-sky-500 shrink-0" />

  const lower = filename.toLowerCase()
  if (
    lower.endsWith(".3dm") ||
    lower.endsWith(".stl") ||
    lower.endsWith(".stp") ||
    lower.endsWith(".step") ||
    lower.endsWith(".glb") ||
    lower.endsWith(".igs") ||
    lower.endsWith(".iges") ||
    lower.endsWith(".zip") ||
    lower.endsWith(".dwg") ||
    lower.endsWith(".dxf")
  ) {
    return <FileCode className="h-4 w-4 text-primary shrink-0" />
  }
  if (lower.endsWith(".pdf") || lower.endsWith(".txt") || lower.endsWith(".doc") || lower.endsWith(".docx")) {
    return <FileText className="h-4 w-4 text-blue-500 shrink-0" />
  }
  return <FileIcon className="h-4 w-4 text-muted-foreground shrink-0" />
}

function parseFileGroups(files: TaskFileItem[]): GroupedFolder[] {
  const groupsMap = new Map<string, GroupedFile[]>()

  for (const file of files) {
    const key = file.key
    const keySegments = key.split("/")

    let folderName = ""

    for (const segment of keySegments) {
      if (/^v\d+$/i.test(segment)) {
        folderName = segment.toUpperCase()
        break
      }
    }

    if (!folderName) {
      for (const segment of keySegments) {
        const match = segment.match(/[-_](v\d+)$/i)
        if (match) {
          folderName = match[1].toUpperCase()
          break
        }
      }
    }

    if (!folderName) {
      const match = key.match(/(?:^|[-_/\s])(v\d+)(?:[-_/\s.]|$)/i)
      if (match) {
        folderName = match[1].toUpperCase()
      }
    }

    if (!folderName) {
      folderName = "General Files"
    }

    const cleanFilename = file.filename.replace(/^\d{10,14}_/, "")

    let subPath = ""
    const folderSegmentIdx = keySegments.findIndex(
      (s) =>
        s.toUpperCase() === folderName ||
        s.toUpperCase().endsWith(`-${folderName}`) ||
        s.toUpperCase().endsWith(`_${folderName}`)
    )
    if (folderSegmentIdx !== -1 && folderSegmentIdx < keySegments.length - 2) {
      const subSegments = keySegments
        .slice(folderSegmentIdx + 1, -1)
        .filter((s) => s.toLowerCase() !== "cad" && s.toUpperCase() !== folderName)
      if (subSegments.length > 0) {
        subPath = subSegments.join("/")
      }
    }

    const groupedFile: GroupedFile = {
      ...file,
      cleanFilename,
      subPath,
    }

    if (!groupsMap.has(folderName)) {
      groupsMap.set(folderName, [])
    }
    groupsMap.get(folderName)!.push(groupedFile)
  }

  const sortedFolderNames = Array.from(groupsMap.keys()).sort((a, b) => {
    const aMatch = a.match(/^V(\d+)$/i)
    const bMatch = b.match(/^V(\d+)$/i)

    if (aMatch && bMatch) {
      return parseInt(aMatch[1], 10) - parseInt(bMatch[1], 10)
    }
    if (aMatch) return -1
    if (bMatch) return 1
    return a.localeCompare(b)
  })

  const result: GroupedFolder[] = []
  for (const fName of sortedFolderNames) {
    result.push({
      folderName: fName,
      files: groupsMap.get(fName)!,
    })
  }

  return result
}

function buildPreviewUrl(taskId: string, file: TaskFileItem): string {
  const base = `/api/tasks/${taskId}/files/download?key=${encodeURIComponent(file.key)}&inline=1`
  if (file.lastModified) {
    return `${base}&v=${new Date(file.lastModified).getTime()}`
  }
  return base
}

export function TaskFilesSidebar({
  taskId,
  linodeFolderName,
  files,
  isQC = false,
}: Props) {
  const router = useRouter()
  const folders = parseFileGroups(files)
  const [preview, setPreview] = useState<PreviewState | null>(null)
  const [replacingKey, setReplacingKey] = useState<string | null>(null)
  const [replaceError, setReplaceError] = useState<string | null>(null)

  const [openFolders, setOpenFolders] = useState<Record<string, boolean>>(() => {
    const initialState: Record<string, boolean> = {}
    folders.forEach((f) => {
      initialState[f.folderName] = true
    })
    return initialState
  })

  const toggleFolder = (folderName: string) => {
    setOpenFolders((prev) => ({
      ...prev,
      [folderName]: !prev[folderName],
    }))
  }

  async function handleReplaceFile(key: string, file: File) {
    setReplaceError(null)
    setReplacingKey(key)
    try {
      const presignedRes = await fetch(
        `/api/tasks/${encodeURIComponent(taskId)}/files/replace/presigned-url`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            key,
            filename: file.name,
            fileSize: file.size,
            contentType: file.type || "application/octet-stream",
          }),
        }
      )

      const presignedData = await presignedRes.json().catch(() => ({}))
      if (!presignedRes.ok || presignedData.error) {
        setReplaceError(presignedData.error || "Failed to start file replacement")
        return
      }

      if (!presignedData.presignedUrl) {
        setReplaceError("Direct storage upload is not configured")
        return
      }

      const uploadRes = await fetch(presignedData.presignedUrl, {
        method: "PUT",
        body: file,
        headers: {
          "Content-Type": file.type || "application/octet-stream",
        },
      })

      if (!uploadRes.ok) {
        setReplaceError(`Storage upload failed (HTTP ${uploadRes.status})`)
        return
      }

      const completeRes = await fetch(
        `/api/tasks/${encodeURIComponent(taskId)}/files/replace/complete`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key, newFilename: file.name }),
        }
      )

      const completeData = await completeRes.json().catch(() => ({}))
      if (!completeRes.ok || completeData.error) {
        setReplaceError(completeData.error || "File uploaded but failed to log replacement")
        return
      }

      router.refresh()
    } catch (err: any) {
      setReplaceError(err.message || "Failed to replace file")
    } finally {
      setReplacingKey(null)
    }
  }

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
        <div className="px-5 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              Linode CAD & Task Files
            </h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Bucket folder: <code className="font-mono text-foreground">tasks/{linodeFolderName}/</code>
            </p>
          </div>
          <Badge variant="secondary" className="text-[10px] font-mono font-semibold">
            {files.length} file{files.length !== 1 ? "s" : ""}
          </Badge>
        </div>
        <Separator />

        {replaceError && (
          <div className="px-5 py-2 text-xs text-destructive bg-destructive/10">
            {replaceError}
          </div>
        )}

        {files.length > 0 ? (
          <div className="divide-y divide-border">
            {folders.map((folder) => {
              const isOpen = openFolders[folder.folderName] ?? true
              const isVersionFolder = /^V\d+$/i.test(folder.folderName)

              return (
                <div key={folder.folderName} className="flex flex-col">
                  <button
                    type="button"
                    onClick={() => toggleFolder(folder.folderName)}
                    className="w-full px-5 py-3 flex items-center justify-between bg-muted/40 hover:bg-muted/70 transition-colors text-left group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {isOpen ? (
                        <FolderOpen className="h-4 w-4 text-amber-500 shrink-0" />
                      ) : (
                        <Folder className="h-4 w-4 text-amber-500 shrink-0" />
                      )}
                      <span className="text-xs font-bold text-foreground tracking-wide font-mono">
                        {folder.folderName}
                      </span>
                      <Badge
                        variant="outline"
                        className={`text-[10px] px-1.5 py-0 font-semibold ${
                          isVersionFolder
                            ? "border-primary/30 bg-primary/10 text-primary"
                            : "border-border bg-background text-muted-foreground"
                        }`}
                      >
                        {folder.files.length} file{folder.files.length !== 1 ? "s" : ""}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-1 text-muted-foreground group-hover:text-foreground">
                      {isOpen ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </div>
                  </button>

                  {isOpen && (
                    <div className="divide-y divide-border/60 bg-background/50 pl-2">
                      {folder.files.map((file) => {
                        const downloadUrl = `/api/tasks/${taskId}/files/download?key=${encodeURIComponent(
                          file.key
                        )}`
                        const dateStr = file.lastModified
                          ? new Date(file.lastModified).toLocaleDateString("en-IN", {
                              day: "numeric",
                              month: "short",
                            })
                          : null
                        const mediaKind = getMediaKind(file.filename)
                        const showPreview = canPreviewMedia(file.filename)

                        return (
                          <div
                            key={file.key}
                            className="px-4 py-3 flex items-center justify-between gap-3 hover:bg-muted/20 transition-colors"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              {mediaKind === "image" ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setPreview({
                                      filename: file.cleanFilename,
                                      previewUrl: buildPreviewUrl(taskId, file),
                                      kind: "image",
                                    })
                                  }
                                  className="h-10 w-10 shrink-0 overflow-hidden rounded-md border border-border bg-muted/50 hover:border-primary/50"
                                >
                                  <img
                                    src={buildPreviewUrl(taskId, file)}
                                    alt={file.cleanFilename}
                                    className="h-full w-full object-cover"
                                  />
                                </button>
                              ) : (
                                <div className="p-1.5 rounded-md bg-muted/50 shrink-0">
                                  {getFileIcon(file.filename)}
                                </div>
                              )}
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  {file.subPath && (
                                    <span className="text-[10px] font-mono font-medium px-1 py-0.5 rounded bg-muted text-muted-foreground shrink-0">
                                      {file.subPath}/
                                    </span>
                                  )}
                                  <p
                                    className="text-xs font-medium text-foreground truncate"
                                    title={file.filename}
                                  >
                                    {file.cleanFilename}
                                  </p>
                                </div>
                                <p className="text-[10px] text-muted-foreground mt-0.5">
                                  {formatFileSize(file.size)}
                                  {dateStr && ` · ${dateStr}`}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              {showPreview && (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-7 px-2 text-[11px]"
                                  onClick={() =>
                                    setPreview({
                                      filename: file.cleanFilename,
                                      previewUrl: buildPreviewUrl(taskId, file),
                                      kind: mediaKind as "image" | "video" | "audio",
                                    })
                                  }
                                >
                                  <Eye className="h-3 w-3 mr-1" />
                                  Preview
                                </Button>
                              )}
                              {isQC && (
                                <label className="inline-flex">
                                  <input
                                    type="file"
                                    className="hidden"
                                    disabled={replacingKey === file.key}
                                    onChange={(e) => {
                                      const f = e.target.files?.[0]
                                      if (f) handleReplaceFile(file.key, f)
                                      e.target.value = ""
                                    }}
                                  />
                                  <span
                                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300 text-[11px] font-medium hover:bg-amber-500/20 transition-colors cursor-pointer ${
                                      replacingKey === file.key ? "opacity-50 pointer-events-none" : ""
                                    }`}
                                  >
                                    {replacingKey === file.key ? "Replacing…" : "Replace"}
                                  </span>
                                </label>
                              )}
                              <a
                                href={downloadUrl}
                                download
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-primary text-primary-foreground text-[11px] font-medium hover:bg-primary/90 transition-colors shadow-2xs"
                              >
                                <Download className="h-3 w-3" />
                                Download
                              </a>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          <div className="px-5 py-8 text-center text-xs text-muted-foreground">
            No CAD or reference files uploaded to Linode storage for this task yet.
          </div>
        )}
      </div>

      <Dialog open={preview !== null} onOpenChange={(open) => !open && setPreview(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="truncate text-sm font-medium">
              {preview?.filename}
            </DialogTitle>
          </DialogHeader>
          {preview?.kind === "image" && (
            <img
              src={preview.previewUrl}
              alt={preview.filename}
              className="max-h-[70vh] w-full rounded-lg object-contain bg-muted/30"
            />
          )}
          {preview?.kind === "video" && (
            <video
              src={preview.previewUrl}
              controls
              className="max-h-[70vh] w-full rounded-lg bg-black"
            />
          )}
          {preview?.kind === "audio" && (
            <audio src={preview.previewUrl} controls className="w-full" />
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
