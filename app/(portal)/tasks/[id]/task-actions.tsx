"use client"

import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useRouter } from "next/navigation"
import { Trash2, UploadCloud } from "lucide-react"
import {
  assignToMeAction,
  startTaskAction,
  submitForQCAction,
  approveSubmissionAction,
  markClientReadyAction,
  sendBackAction,
  closeTaskAction,
  reopenForClientRevisionAction,
} from "./actions"

type Props = {
  task: {
    id: string
    readable_id?: string
    status: string
    assigned_to: string | null
    drive_folder_link?: string | null
  }
  session: { id: string; roles: string[] }
  pendingSubmission: { id: string; drive_link: string } | null
  designers: { id: string; name: string }[]
  currentPoints: number
}

function filterValidCadFiles(files: File[]) {
  return files.filter((file) => file.size > 0 && !file.name.startsWith("."))
}

function CadUploadPicker({
  selectedFiles,
  onAddFiles,
  onRemoveFile,
  folderInputId,
  filesInputId,
  disabled,
}: {
  selectedFiles: File[]
  onAddFiles: (files: File[], append: boolean) => void
  onRemoveFile: (index: number) => void
  folderInputId: string
  filesInputId: string
  disabled?: boolean
}) {
  const appendMode = selectedFiles.length > 0

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const validFiles = filterValidCadFiles(Array.from(e.target.files || []))
    if (validFiles.length > 0) {
      onAddFiles(validFiles, appendMode)
    }
    e.target.value = ""
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    if (disabled) return
    const dropped = filterValidCadFiles(Array.from(e.dataTransfer.files || []))
    if (dropped.length > 0) {
      onAddFiles(dropped, appendMode)
    }
  }

  return (
    <div
      className="rounded-lg border-2 border-dashed border-primary/30 bg-background transition-colors hover:border-primary/50"
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
    >
      <input
        id={folderInputId}
        type="file"
        // @ts-expect-error webkitdirectory is supported in modern browsers
        webkitdirectory=""
        directory=""
        multiple
        onChange={handleInputChange}
        className="hidden"
        disabled={disabled}
      />
      <input
        id={filesInputId}
        type="file"
        multiple
        onChange={handleInputChange}
        className="hidden"
        disabled={disabled}
      />

      {selectedFiles.length > 0 && (
        <div className="p-2.5 pb-0">
          <p className="text-xs font-semibold text-foreground mb-2">
            {selectedFiles.length} file(s) selected
          </p>
          <ul className="max-h-40 overflow-y-auto space-y-1">
            {selectedFiles.map((file, index) => (
              <li
                key={`${file.webkitRelativePath || file.name}-${index}`}
                className="flex items-center gap-2 rounded-md border border-border/60 bg-muted/30 px-2 py-1"
              >
                <span className="truncate flex-1 font-mono text-[11px] text-muted-foreground">
                  {file.webkitRelativePath || file.name}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => onRemoveFile(index)}
                  disabled={disabled}
                  aria-label="Remove file"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div
        className={`flex flex-col items-center justify-center px-4 py-4 text-center ${
          selectedFiles.length > 0 ? "border-t border-border/60 mt-2" : ""
        }`}
      >
        <UploadCloud className="h-6 w-6 text-primary mb-1.5" />
        <p className="text-xs font-medium text-foreground">
          {selectedFiles.length > 0
            ? "Add more CAD files or folder"
            : "Add CAD files or folder"}
        </p>
        <p className="text-[10px] text-muted-foreground mt-0.5 mb-2">
          Drag & drop here, or browse below
        </p>
        <div className="flex items-center gap-1.5 text-xs">
          <button
            type="button"
            className="font-medium text-primary hover:underline disabled:opacity-50"
            disabled={disabled}
            onClick={() => document.getElementById(filesInputId)?.click()}
          >
            Browse files
          </button>
          <span className="text-muted-foreground">·</span>
          <button
            type="button"
            className="font-medium text-primary hover:underline disabled:opacity-50"
            disabled={disabled}
            onClick={() => document.getElementById(folderInputId)?.click()}
          >
            Browse folder
          </button>
        </div>
      </div>
    </div>
  )
}

export function TaskActions({
  task,
  session,
  pendingSubmission,
  designers,
  currentPoints,
}: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [driveLink, setDriveLink] = useState("")
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [remarks, setRemarks] = useState("")

  const [showSendBack, setShowSendBack] = useState(false)
  const [showReopen, setShowReopen] = useState(false)
  const [revisionNotes, setRevisionNotes] = useState("")
  const [designerNotes, setDesignerNotes] = useState("")
  const [folderPath, setFolderPath] = useState("")
  const [newPoints, setNewPoints] = useState(String(currentPoints))
  const [newDesignerId, setNewDesignerId] = useState("")

  const isManager = session.roles.includes("manager")
  const isQC = session.roles.includes("qc")
  const isDesigner = session.roles.includes("designer")
  // QC can also work on tasks as a designer
  const canWork = isDesigner || isQC
  const isAssignedWorker =
    task.assigned_to !== null && String(task.assigned_to) === String(session.id)
  const isUnassignedTask = task.assigned_to === null

  const isAssignedDesigner = isAssignedWorker

  const apiTaskKey = task.id || task.readable_id || ""

  function run(fn: () => Promise<{ error?: string } | void | undefined>) {
    setError(null)
    startTransition(async () => {
      try {
        const result = await fn()
        if (result && "error" in result && result.error) setError(result.error)
      } catch (err: any) {
        console.error("Task action error:", err)
        setError(err.message || "An unexpected error occurred.")
      }
    })
  }

  const addCadFiles = (files: File[], append: boolean) => {
    const validFiles = filterValidCadFiles(files)
    if (validFiles.length === 0) return
    if (append) {
      setSelectedFiles((prev) => [...prev, ...validFiles])
    } else {
      setSelectedFiles(validFiles)
    }
  }

  const removeSelectedFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const [uploadStatus, setUploadStatus] = useState<string | null>(null)

  function handleSubmitWithFiles() {
    const validFiles = selectedFiles.filter(
      (f) => f.size > 0 && !f.name.startsWith(".")
    )
    if (validFiles.length === 0 && !driveLink.trim()) return

    setError(null)
    setUploadStatus(null)
    startTransition(async () => {
      try {
        if (validFiles.length > 0) {
          let lastUploadedUrl = ""
          let lastVersion = ""
          let usedPresigned = false

          for (let i = 0; i < validFiles.length; i++) {
            const file = validFiles[i]
            setUploadStatus(
              `Preparing upload ${i + 1}/${validFiles.length}: ${file.name}...`
            )

            // Step 1: Request presigned upload URL from server
            const presignedRes = await fetch(
              `/api/tasks/${encodeURIComponent(apiTaskKey)}/upload/presigned-url`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  filename: file.name,
                  fileSize: file.size,
                  contentType: file.type || "application/octet-stream",
                }),
              }
            )

            let presignedData: any = {}
            try {
              presignedData = await presignedRes.json()
            } catch {
              presignedData = { error: `Server returned status ${presignedRes.status}` }
            }

            if (!presignedRes.ok || presignedData.error) {
              if (presignedRes.status === 401) {
                setError("Your session has expired. Please refresh the page and log in again.")
              } else {
                setError(
                  presignedData.error ||
                    `Failed to generate upload URL for: ${file.name}`
                )
              }
              setUploadStatus(null)
              return
            }

            const { presignedUrl, fileUrl, version, isFallback } = presignedData
            lastUploadedUrl = fileUrl
            lastVersion = version

            // Step 2: Upload file directly to Linode Object Storage or fallback
            if (presignedUrl && !isFallback) {
              usedPresigned = true
              await new Promise<void>((resolve, reject) => {
                const xhr = new XMLHttpRequest()
                xhr.open("PUT", presignedUrl, true)
                xhr.setRequestHeader(
                  "Content-Type",
                  file.type || "application/octet-stream"
                )

                xhr.upload.onprogress = (event) => {
                  if (event.lengthComputable) {
                    const percent = Math.round(
                      (event.loaded / event.total) * 100
                    )
                    setUploadStatus(
                      `Uploading file ${i + 1}/${validFiles.length}: ${file.name} (${percent}%)...`
                    )
                  }
                }

                xhr.onload = () => {
                  if (xhr.status >= 200 && xhr.status < 300) {
                    resolve()
                  } else {
                    reject(
                      new Error(
                        `Storage upload failed with HTTP status ${xhr.status}. Please check CORS settings on Linode Object Storage.`
                      )
                    )
                  }
                }

                xhr.onerror = () =>
                  reject(
                    new Error(
                      "Network error during direct file upload to Object Storage."
                    )
                  )
                xhr.send(file)
              })
            } else {
              // Dev Fallback mode if Linode env variables are missing
              const CHUNK_SIZE = 4 * 1024 * 1024
              const totalChunks = Math.ceil(file.size / CHUNK_SIZE) || 1
              const isLastFile = i === validFiles.length - 1

              for (let c = 0; c < totalChunks; c++) {
                const start = c * CHUNK_SIZE
                const end = Math.min(start + CHUNK_SIZE, file.size)
                const chunkBlob = file.slice(start, end)
                const isLastChunk = c === totalChunks - 1

                const percent = Math.round(((c + 1) / totalChunks) * 100)
                setUploadStatus(
                  `Uploading file ${i + 1}/${validFiles.length}: ${file.name} (${percent}%)...`
                )

                const res = await fetch(`/api/tasks/${encodeURIComponent(apiTaskKey)}/upload`, {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/octet-stream",
                    "x-file-name": encodeURIComponent(file.name),
                    "x-file-size": String(file.size),
                    "x-file-type": encodeURIComponent(
                      file.type || "application/octet-stream"
                    ),
                    "x-chunk-index": String(c),
                    "x-total-chunks": String(totalChunks),
                    "x-is-last-chunk": isLastChunk ? "true" : "false",
                    "x-is-last-file": isLastFile ? "true" : "false",
                  },
                  body: chunkBlob,
                })

                const data = await res.json()
                if (!res.ok || data.error) {
                  setError(
                    data.error || `Failed to upload file: ${file.name}`
                  )
                  setUploadStatus(null)
                  return
                }
              }
            }
          }

          // Step 3: Complete submission in DB if presigned upload was used
          if (usedPresigned && lastUploadedUrl) {
            setUploadStatus("Finalizing submission...")
            const completeRes = await fetch(
              `/api/tasks/${encodeURIComponent(apiTaskKey)}/upload/complete`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  fileUrl: lastUploadedUrl,
                  version: lastVersion,
                  designerNotes: designerNotes,
                  folderPath: folderPath,
                }),
              }
            )

            const completeData = await completeRes.json()
            if (!completeRes.ok || completeData.error) {
              setError(
                completeData.error || "Failed to finalize task submission record."
              )
              setUploadStatus(null)
              return
            }
          }

          setUploadStatus("Upload complete!")
          setSelectedFiles([])
          setDesignerNotes("")
          setFolderPath("")
          router.refresh()
        } else {
          const res = await submitForQCAction(task.id, driveLink, designerNotes, folderPath)
          if (res?.error) setError(res.error)
          else {
            setDesignerNotes("")
            setFolderPath("")
            router.refresh()
          }
        }
      } catch (err: any) {
        setError(err.message || "Failed to submit for QC.")
        setUploadStatus(null)
      }
    })
  }

  if (
    !isManager &&
    !isQC &&
    !isAssignedWorker &&
    !(canWork && isUnassignedTask)
  )
    return null

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5 shadow-xs">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
          Task Actions
        </h2>
        {uploadStatus && (
          <span className="text-xs font-medium text-primary animate-pulse">
            {uploadStatus}
          </span>
        )}
      </div>

      {error && (
        <div className="rounded-lg bg-destructive/10 p-3 text-xs text-destructive">
          {error}
        </div>
      )}

      <div className="flex flex-col gap-3">
        {/* Designer/QC: Self-assign (does not start work timer) */}
        {canWork &&
          isUnassignedTask &&
          (task.status === "assigned" ||
            task.status === "revision_requested" ||
            task.status === "in_progress") && (
            <div>
              <p className="mb-2 text-xs text-muted-foreground">
                Claim this task to yourself before starting work.
              </p>
              <Button
                onClick={() => run(() => assignToMeAction(task.id))}
                disabled={isPending}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {isPending ? "Assigning…" : "Assign to Me"}
              </Button>
            </div>
          )}

        {/* Designer/QC: Start work (timer begins here) */}
        {isAssignedDesigner &&
          (task.status === "assigned" || task.status === "revision_requested") && (
            <div>
              <p className="mb-2 text-xs text-muted-foreground">
                Start working to begin tracking your CAD build time.
              </p>
              <Button
                onClick={() => run(() => startTaskAction(task.id))}
                disabled={isPending}
                className="w-full"
              >
                {isPending ? "Starting…" : "Start"}
              </Button>
            </div>
          )}

        {!canWork &&
          isUnassignedTask &&
          !isManager &&
          !isQC && (
            <p className="text-xs text-muted-foreground">
              This task is unassigned. A designer or QC member must claim and start it.
            </p>
          )}

        {isManager &&
          isUnassignedTask &&
          !canWork &&
          task.status !== "closed" &&
          task.status !== "client_ready" && (
            <p className="text-xs text-muted-foreground">
              Task is unassigned. Designers or QC can use Assign to Me and Start from their account.
            </p>
          )}

        {task.status === "in_progress" && isAssignedDesigner && (
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-3 rounded-lg border border-primary/20 bg-primary/5 p-3.5">
              <div>
                <p className="text-xs font-semibold text-primary uppercase tracking-wide">
                  Linode Task Storage
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Select a folder or individual CAD files to upload into Linode storage.
                </p>
              </div>

              <CadUploadPicker
                selectedFiles={selectedFiles}
                onAddFiles={addCadFiles}
                onRemoveFile={removeSelectedFile}
                folderInputId="cad_files_upload_folder"
                filesInputId="cad_files_upload_files"
                disabled={isPending}
              />

              <div className="flex flex-col gap-1.5 mt-1">
                <Label htmlFor="designer_notes" className="text-xs font-medium">
                  Description / Notes for QC (Optional)
                </Label>
                <Textarea
                  id="designer_notes"
                  placeholder="Write description or notes for QC..."
                  value={designerNotes}
                  onChange={(e) => setDesignerNotes(e.target.value)}
                  rows={2}
                  disabled={isPending}
                  className="bg-background"
                />
              </div>

              <Button
                onClick={handleSubmitWithFiles}
                disabled={isPending || selectedFiles.length === 0}
                className="w-full mt-1"
              >
                {isPending
                  ? uploadStatus || "Uploading CAD Files & Submitting..."
                  : "Submit for QC"}
              </Button>
            </div>
          </div>
        )}

        {/* Designer: Revision resubmit */}
        {task.status === "revision_requested" && isAssignedDesigner && (
          <div className="flex flex-col gap-3">
            <div className="rounded-lg bg-destructive/10 px-3.5 py-2.5">
              <p className="text-xs font-semibold text-destructive">
                Revision Requested
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Fix the issues noted by QC, then upload your updated CAD files to resubmit.
              </p>
            </div>

            <div className="flex flex-col gap-3 rounded-lg border border-primary/20 bg-primary/5 p-3.5">
              <div>
                <p className="text-xs font-semibold text-primary uppercase tracking-wide">
                  Linode Task Storage (Resubmission)
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Select a folder or individual CAD files to upload for resubmission.
                </p>
              </div>

              <CadUploadPicker
                selectedFiles={selectedFiles}
                onAddFiles={addCadFiles}
                onRemoveFile={removeSelectedFile}
                folderInputId="cad_files_resubmit_folder"
                filesInputId="cad_files_resubmit_files"
                disabled={isPending}
              />

              <div className="flex flex-col gap-1.5 mt-1">
                <Label htmlFor="folder_path_resubmit" className="text-xs font-medium">
                  Local / Shared Folder Path (Optional)
                </Label>
                <Input
                  id="folder_path_resubmit"
                  placeholder="e.g. \\server\share\folder or Z:\Projects\CAD"
                  value={folderPath}
                  onChange={(e) => setFolderPath(e.target.value)}
                  disabled={isPending}
                  className="bg-background"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="designer_notes_resubmit" className="text-xs font-medium">
                  Description / Notes for QC (Optional)
                </Label>
                <Textarea
                  id="designer_notes_resubmit"
                  placeholder="Write description or updated notes for QC..."
                  value={designerNotes}
                  onChange={(e) => setDesignerNotes(e.target.value)}
                  rows={2}
                  disabled={isPending}
                  className="bg-background"
                />
              </div>

              <Button
                onClick={handleSubmitWithFiles}
                disabled={isPending || (selectedFiles.length === 0 && !folderPath.trim())}
                className="w-full mt-1"
              >
                {isPending
                  ? uploadStatus || "Uploading CAD Files & Resubmitting..."
                  : "Resubmit for QC"}
              </Button>
            </div>
          </div>
        )}


        {/* QC: Approve → Ready for Client */}
        {task.status === "in_qc_review" && isQC && pendingSubmission && (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">
                Review the submitted CAD and take action.
              </p>
              {!showSendBack ? (
                <div className="flex gap-2">
                  <Button
                    onClick={() =>
                      run(() =>
                        approveSubmissionAction(task.id, pendingSubmission.id)
                      )
                    }
                    disabled={isPending}
                    className="bg-teal-600 text-white hover:bg-teal-700"
                  >
                    {isPending ? "Approving…" : "Approve (Ready for Client)"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setShowSendBack(true)}
                    disabled={isPending}
                    className="border-destructive/40 text-destructive hover:bg-destructive/10"
                  >
                    Send Back
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <Textarea
                    placeholder="Describe the issues clearly for the designer..."
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    rows={3}
                    disabled={isPending}
                  />
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="border-destructive/40 text-destructive hover:bg-destructive/10"
                      onClick={() =>
                        run(() =>
                          sendBackAction(task.id, pendingSubmission.id, remarks)
                        )
                      }
                      disabled={isPending || !remarks.trim()}
                    >
                      {isPending ? "Sending…" : "Send Back with Remarks"}
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => setShowSendBack(false)}
                      disabled={isPending}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

        {/* Manager: Send back while in QC (cannot approve — QC moves to Ready for Client) */}
        {task.status === "in_qc_review" &&
          isManager &&
          !isQC &&
          pendingSubmission && (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">
                Waiting for QC approval. You can send the task back to the designer if needed.
              </p>
              {!showSendBack ? (
                <Button
                  variant="outline"
                  onClick={() => setShowSendBack(true)}
                  disabled={isPending}
                  className="border-destructive/40 text-destructive hover:bg-destructive/10"
                >
                  Send Back
                </Button>
              ) : (
                <div className="flex flex-col gap-2">
                  <Textarea
                    placeholder="Describe the issues clearly for the designer..."
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    rows={3}
                    disabled={isPending}
                  />
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="border-destructive/40 text-destructive hover:bg-destructive/10"
                      onClick={() =>
                        run(() =>
                          sendBackAction(task.id, pendingSubmission.id, remarks)
                        )
                      }
                      disabled={isPending || !remarks.trim()}
                    >
                      {isPending ? "Sending…" : "Send Back with Remarks"}
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => setShowSendBack(false)}
                      disabled={isPending}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

        {/* Manager: Ready for Client → Client Ready */}
        {task.status === "ready_for_client" && isManager && (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-muted-foreground">
              QC approved this task. Mark it as Client Ready once it is ready to deliver.
            </p>
            <Button
              onClick={() => run(() => markClientReadyAction(task.id))}
              disabled={isPending}
              className="bg-emerald-600 text-white hover:bg-emerald-700"
            >
              {isPending ? "Updating…" : "Approve — Mark as Client Ready"}
            </Button>
          </div>
        )}

        {task.status === "ready_for_client" && isQC && !isManager && (
          <p className="text-sm text-muted-foreground">
            Approved — waiting for a manager to mark this task as Client Ready.
          </p>
        )}

        {/* Manager: Close task */}
        {task.status === "client_ready" && isManager && (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-muted-foreground">
              Mark this task as delivered to the client.
            </p>
            <Button
              variant="outline"
              onClick={() => run(() => closeTaskAction(task.id))}
              disabled={isPending}
            >
              {isPending ? "Closing…" : "Close Task"}
            </Button>
          </div>
        )}

        {/* Manager/QC: Client revision on closed/client_ready task */}
        {(task.status === "closed" ||
          task.status === "client_ready" ||
          task.status === "ready_for_client") &&
          (isManager || isQC) && (
            <div className="flex flex-col gap-2 border-t border-border pt-3">
              {!showReopen ? (
                <Button
                  variant="outline"
                  onClick={() => setShowReopen(true)}
                  disabled={isPending}
                >
                  Reopen for Client Revision
                </Button>
              ) : (
                <div className="flex flex-col gap-3">
                  <p className="text-sm font-medium">Client Revision Details</p>
                  <div className="flex flex-col gap-1.5">
                    <Label>Revision Notes</Label>
                    <Textarea
                      placeholder="Describe what the client wants changed..."
                      value={revisionNotes}
                      onChange={(e) => setRevisionNotes(e.target.value)}
                      rows={3}
                      disabled={isPending}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1.5">
                      <Label>New Points</Label>
                      <Input
                        type="number"
                        min={1}
                        value={newPoints}
                        onChange={(e) => setNewPoints(e.target.value)}
                        disabled={isPending}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label>Assign to (optional)</Label>
                      <Select
                        value={newDesignerId}
                        onValueChange={setNewDesignerId}
                        disabled={isPending}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Open to all designers" />
                        </SelectTrigger>
                        <SelectContent>
                          {designers.map((d) => (
                            <SelectItem key={d.id} value={d.id}>
                              {d.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() =>
                        run(() =>
                          reopenForClientRevisionAction(
                            task.id,
                            revisionNotes,
                            parseFloat(newPoints) || currentPoints,
                            newDesignerId || null
                          )
                        )
                      }
                      disabled={isPending || !revisionNotes.trim()}
                    >
                      {isPending ? "Reopening…" : "Reopen Task"}
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => setShowReopen(false)}
                      disabled={isPending}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

        {error && (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}
      </div>
    </div>
  )
}
