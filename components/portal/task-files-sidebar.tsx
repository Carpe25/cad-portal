"use client"

import { useState } from "react"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
} from "lucide-react"

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
}

type GroupedFile = TaskFileItem & {
  cleanFilename: string
  subPath?: string
}

type GroupedFolder = {
  folderName: string
  files: GroupedFile[]
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function getFileIcon(filename: string) {
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
  if (
    lower.endsWith(".png") ||
    lower.endsWith(".jpg") ||
    lower.endsWith(".jpeg") ||
    lower.endsWith(".webp") ||
    lower.endsWith(".gif") ||
    lower.endsWith(".svg")
  ) {
    return <ImageIcon className="h-4 w-4 text-emerald-500 shrink-0" />
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

    // 1. Look for standalone segment matching V1, V2, V3...
    for (const segment of keySegments) {
      if (/^v\d+$/i.test(segment)) {
        folderName = segment.toUpperCase()
        break
      }
    }

    // 2. Look for segment ending with -V1, _V1, -V2, _V2 (e.g. "202-PRJ-01-V1")
    if (!folderName) {
      for (const segment of keySegments) {
        const match = segment.match(/[-_](v\d+)$/i)
        if (match) {
          folderName = match[1].toUpperCase()
          break
        }
      }
    }

    // 3. Look for -V1-, _V1_, -V1., _V1. anywhere in key
    if (!folderName) {
      const match = key.match(/(?:^|[-_/\s])(v\d+)(?:[-_/\s.]|$)/i)
      if (match) {
        folderName = match[1].toUpperCase()
      }
    }

    // 4. Default to General Files if no version detected
    if (!folderName) {
      folderName = "General Files"
    }

    // Clean timestamp prefix (e.g. 1740000000000_)
    const cleanFilename = file.filename.replace(/^\d{10,14}_/, "")

    // Subpath calculation if nested in subfolder
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

  // Sort folder keys: V1, V2, V3... then General Files
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

export function TaskFilesSidebar({ taskId, linodeFolderName, files }: Props) {
  const folders = parseFileGroups(files)

  // Track which folders are open (default all open)
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

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
      {/* Sidebar Card Header */}
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

      {/* Folders & Files Listing */}
      {files.length > 0 ? (
        <div className="divide-y divide-border">
          {folders.map((folder) => {
            const isOpen = openFolders[folder.folderName] ?? true
            const isVersionFolder = /^V\d+$/i.test(folder.folderName)

            return (
              <div key={folder.folderName} className="flex flex-col">
                {/* Folder Header */}
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

                {/* Folder Files List */}
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

                      return (
                        <div
                          key={file.key}
                          className="px-4 py-3 flex items-center justify-between gap-3 hover:bg-muted/20 transition-colors"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="p-1.5 rounded-md bg-muted/50 shrink-0">
                              {getFileIcon(file.filename)}
                            </div>
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

                          <a
                            href={downloadUrl}
                            download
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-primary text-primary-foreground text-[11px] font-medium hover:bg-primary/90 transition-colors shrink-0 shadow-2xs"
                          >
                            <Download className="h-3 w-3" />
                            Download
                          </a>
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
  )
}
