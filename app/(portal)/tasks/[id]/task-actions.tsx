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
import { FolderUp, UploadCloud } from "lucide-react"
import {
  assignToMeAction,
  submitForQCAction,
  approveSubmissionAction,
  sendBackAction,
  closeTaskAction,
  reopenForClientRevisionAction,
} from "./actions"

type Props = {
  task: {
    id: string
    status: string
    assigned_to: string | null
    drive_folder_link?: string | null
  }
  session: { id: string; roles: string[] }
  pendingSubmission: { id: string; drive_link: string } | null
  designers: { id: string; name: string }[]
  currentPoints: number
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
  const [newPoints, setNewPoints] = useState(String(currentPoints))
  const [newDesignerId, setNewDesignerId] = useState("")

  const isManager = session.roles.includes("manager")
  const isQC = session.roles.includes("qc")
  const isDesigner = session.roles.includes("designer")
  // QC can also work on tasks as a designer
  const canWork = isDesigner || isQC
  const isAssignedWorker = task.assigned_to === session.id
  const isUnassignedTask = task.assigned_to === null

  // Keep legacy alias used in JSX below
  const isAssignedDesigner = isAssignedWorker

  function run(fn: () => Promise<{ error?: string } | void | undefined>) {
    setError(null)
    startTransition(async () => {
      const result = await fn()
      if (result && "error" in result && result.error) setError(result.error)
    })
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawFiles = Array.from(e.target.files || [])
    const validFiles = rawFiles.filter(
      (file) => file.size > 0 && !file.name.startsWith(".")
    )
    setSelectedFiles(validFiles)
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
          for (let i = 0; i < validFiles.length; i++) {
            const file = validFiles[i]
            setUploadStatus(
              `Uploading file ${i + 1} of ${validFiles.length}: ${file.name}...`
            )

            const res = await fetch(`/api/tasks/${task.id}/upload`, {
              method: "POST",
              headers: {
                "Content-Type": "application/octet-stream",
                "x-file-name": encodeURIComponent(file.name),
                "x-file-type": encodeURIComponent(file.type || "application/octet-stream"),
                "x-drive-link": encodeURIComponent(driveLink || ""),
                "x-is-last": i === validFiles.length - 1 ? "true" : "false",
              },
              body: file,
            })

            const data = await res.json()
            if (!res.ok || data.error) {
              setError(data.error || `Failed to upload file: ${file.name}`)
              setUploadStatus(null)
              return
            }
          }
          setUploadStatus("Upload complete!")
          router.refresh()
        } else {
          const res = await submitForQCAction(task.id, driveLink)
          if (res?.error) setError(res.error)
        }
      } catch (err: any) {
        setError(err.message || "Failed to submit for QC.")
        setUploadStatus(null)
      }
    })
  }


  // No actions to show
  if (
    !isManager &&
    !isQC &&
    !isAssignedWorker &&
    !(canWork && isUnassignedTask)
  )
    return null

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h2 className="mb-3 text-xs font-medium tracking-wide text-muted-foreground uppercase">
        Actions
      </h2>

      <div className="flex flex-col gap-3">
        {/* Designer/QC: Assign to me */}
        {task.status === "assigned" &&
          (isAssignedDesigner || (canWork && isUnassignedTask)) && (
            <div>
              <p className="mb-2 text-sm text-muted-foreground">
                This task is waiting for you to accept it.
              </p>
              <Button
                onClick={() => run(() => assignToMeAction(task.id))}
                disabled={isPending}
              >
                {isPending ? "Assigning…" : "Assign to Me & Start"}
              </Button>
            </div>
          )}

        {/* Designer: Submit for QC */}
        {task.status === "in_progress" && isAssignedDesigner && (
          <div className="flex flex-col gap-3">
            {task.drive_folder_link ? (
              <div className="flex flex-col gap-3 rounded-lg border border-primary/20 bg-primary/5 p-3.5">
                <div>
                  <p className="text-xs font-semibold text-primary uppercase tracking-wide">
                    Google Drive Folder Connected
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Select your CAD folder or files to upload directly into the task's Google Drive folder.
                  </p>
                </div>

                <div className="flex flex-col gap-2">
                  <label
                    htmlFor="cad_files_upload"
                    className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-primary/30 p-4 text-center hover:border-primary hover:bg-primary/10 transition-colors bg-background"
                  >
                    <FolderUp className="h-6 w-6 text-primary mb-1" />
                    <span className="text-xs font-medium text-foreground">
                      Select CAD Folder / Files
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      Click to pick folder or CAD files
                    </span>
                    <input
                      id="cad_files_upload"
                      type="file"
                      // @ts-expect-error webkitdirectory is supported in modern browsers
                      webkitdirectory=""
                      directory=""
                      multiple
                      onChange={handleFileSelect}
                      className="hidden"
                      disabled={isPending}
                    />
                  </label>

                  {selectedFiles.length > 0 && (
                    <div className="rounded-md border border-border bg-background p-2.5">
                      <p className="text-xs font-semibold text-foreground mb-1">
                        {selectedFiles.length} file(s) selected:
                      </p>
                      <ul className="max-h-24 overflow-y-auto text-[11px] text-muted-foreground space-y-0.5 font-mono">
                        {selectedFiles.slice(0, 10).map((f, i) => (
                          <li key={i} className="truncate">• {f.name}</li>
                        ))}
                        {selectedFiles.length > 10 && (
                          <li className="italic text-primary">...and {selectedFiles.length - 10} more files</li>
                        )}
                      </ul>
                    </div>
                  )}
                </div>

                <Button
                  onClick={handleSubmitWithFiles}
                  disabled={isPending || selectedFiles.length === 0}
                  className="w-full"
                >
                  {isPending
                    ? uploadStatus || "Uploading CAD Files & Submitting..."
                    : "Submit for QC"}
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <p className="text-xs text-muted-foreground">
                  Paste the Drive link to your completed CAD file and add any description/notes for QC.
                </p>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="drive_link" className="text-xs">
                    Drive Link
                  </Label>
                  <Input
                    id="drive_link"
                    placeholder="https://drive.google.com/drive/folders/..."
                    value={driveLink}
                    onChange={(e) => setDriveLink(e.target.value)}
                    disabled={isPending}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="designer_notes" className="text-xs">
                    Description / Notes for QC
                  </Label>
                  <Textarea
                    id="designer_notes"
                    placeholder="Write description or notes for QC..."
                    value={designerNotes}
                    onChange={(e) => setDesignerNotes(e.target.value)}
                    rows={3}
                    disabled={isPending}
                  />
                </div>
                <Button
                  onClick={() => run(() => submitForQCAction(task.id, driveLink, designerNotes))}
                  disabled={isPending || !driveLink.trim()}
                >
                  {isPending ? "Submitting…" : "Submit for QC"}
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Designer: Revision resubmit */}
        {task.status === "revision_requested" && isAssignedDesigner && (
          <div className="flex flex-col gap-3">
            <div className="rounded-lg bg-destructive/10 px-3 py-2">
              <p className="text-xs font-medium text-destructive">
                Revision Requested
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Fix the issues noted by QC, then resubmit your CAD files.
              </p>
            </div>
            {task.drive_folder_link ? (
              <div className="flex flex-col gap-3 rounded-lg border border-primary/20 bg-primary/5 p-3.5">
                <div className="flex flex-col gap-2">
                  <label
                    htmlFor="cad_files_resubmit"
                    className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-primary/30 p-4 text-center hover:border-primary hover:bg-primary/10 transition-colors bg-background"
                  >
                    <FolderUp className="h-6 w-6 text-primary mb-1" />
                    <span className="text-xs font-medium text-foreground">
                      Select Updated CAD Folder / Files
                    </span>
                    <input
                      id="cad_files_resubmit"
                      type="file"
                      // @ts-expect-error webkitdirectory is supported in modern browsers
                      webkitdirectory=""
                      directory=""
                      multiple
                      onChange={handleFileSelect}
                      className="hidden"
                      disabled={isPending}
                    />
                  </label>

                  {selectedFiles.length > 0 && (
                    <div className="rounded-md border border-border bg-background p-2.5">
                      <p className="text-xs font-semibold text-foreground mb-1">
                        {selectedFiles.length} file(s) selected:
                      </p>
                      <ul className="max-h-24 overflow-y-auto text-[11px] text-muted-foreground space-y-0.5 font-mono">
                        {selectedFiles.slice(0, 10).map((f, i) => (
                          <li key={i} className="truncate">• {f.name}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                <Button
                  onClick={handleSubmitWithFiles}
                  disabled={isPending || selectedFiles.length === 0}
                  className="w-full"
                >
                  {isPending
                    ? uploadStatus || "Uploading CAD Files & Resubmitting..."
                    : "Resubmit for QC"}
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="drive_link_resubmit" className="text-xs">
                    Drive Link
                  </Label>
                  <Input
                    id="drive_link_resubmit"
                    placeholder="Paste updated drive link..."
                    value={driveLink}
                    onChange={(e) => setDriveLink(e.target.value)}
                    disabled={isPending}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="designer_notes_resubmit" className="text-xs">
                    Description / Notes for QC
                  </Label>
                  <Textarea
                    id="designer_notes_resubmit"
                    placeholder="Write description or updated notes for QC..."
                    value={designerNotes}
                    onChange={(e) => setDesignerNotes(e.target.value)}
                    rows={3}
                    disabled={isPending}
                  />
                </div>
                <Button
                  onClick={() => run(() => submitForQCAction(task.id, driveLink, designerNotes))}
                  disabled={isPending || !driveLink.trim()}
                >
                  {isPending ? "Resubmitting…" : "Resubmit for QC"}
                </Button>
              </div>
            )}
          </div>
        )}


        {/* QC / Manager: Approve or Send Back */}
        {task.status === "in_qc_review" &&
          (isQC || isManager) &&
          pendingSubmission && (
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
                    className="bg-emerald-600 text-white hover:bg-emerald-700"
                  >
                    {isPending ? "Approving…" : "Approve"}
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

        {/* Manager: Client revision on closed/client_ready task */}
        {(task.status === "closed" || task.status === "client_ready") &&
          isManager && (
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
                            parseInt(newPoints, 10) || currentPoints,
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
