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
import {
  assignToMeAction,
  submitForQCAction,
  approveSubmissionAction,
  sendBackAction,
  closeTaskAction,
  reopenForClientRevisionAction,
} from "./actions"

type Props = {
  task: { id: string; status: string; assigned_to: string | null }
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
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [driveLink, setDriveLink] = useState("")
  const [remarks, setRemarks] = useState("")
  const [showSendBack, setShowSendBack] = useState(false)
  const [showReopen, setShowReopen] = useState(false)
  const [revisionNotes, setRevisionNotes] = useState("")
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

  // No actions to show
  if (
    !isManager &&
    !isQC &&
    !isAssignedWorker &&
    !(canWork && isUnassignedTask)
  ) return null

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Actions
      </h2>

      <div className="flex flex-col gap-3">

        {/* Designer/QC: Assign to me */}
        {task.status === "assigned" && (isAssignedDesigner || (canWork && isUnassignedTask)) && (
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
          <div className="flex flex-col gap-2">
            <p className="text-sm text-muted-foreground">
              Paste the drive link to your completed CAD file.
            </p>
            <Input
              placeholder="https://drive.google.com/drive/folders/..."
              value={driveLink}
              onChange={(e) => setDriveLink(e.target.value)}
              disabled={isPending}
            />
            <Button
              onClick={() => run(() => submitForQCAction(task.id, driveLink))}
              disabled={isPending || !driveLink.trim()}
            >
              {isPending ? "Submitting…" : "Submit for QC"}
            </Button>
          </div>
        )}

        {/* Designer: Revision resubmit */}
        {task.status === "revision_requested" && isAssignedDesigner && (
          <div className="flex flex-col gap-2">
            <div className="rounded-lg bg-destructive/10 px-3 py-2">
              <p className="text-xs font-medium text-destructive">
                Revision Requested
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Fix the issues noted by QC, then resubmit.
              </p>
            </div>
            <Input
              placeholder="Paste updated drive link..."
              value={driveLink}
              onChange={(e) => setDriveLink(e.target.value)}
              disabled={isPending}
            />
            <Button
              onClick={() => run(() => submitForQCAction(task.id, driveLink))}
              disabled={isPending || !driveLink.trim()}
            >
              {isPending ? "Resubmitting…" : "Resubmit for QC"}
            </Button>
          </div>
        )}

        {/* QC / Manager: Approve or Send Back */}
        {task.status === "in_qc_review" && (isQC || isManager) && pendingSubmission && (
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
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {isPending ? "Approving…" : "Approve"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowSendBack(true)}
                  disabled={isPending}
                  className="text-destructive border-destructive/40 hover:bg-destructive/10"
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
                    className="text-destructive border-destructive/40 hover:bg-destructive/10"
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
