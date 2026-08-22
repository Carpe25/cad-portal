import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { FolderPathLink } from "@/components/folder-path-link"
import { FormattedTextWithLinks } from "@/components/portal/formatted-text"
import {
  formatDateTimeDisplay,
  isSubmissionLate,
} from "@/lib/task-utils"
import type { FileReplacementLog } from "@/lib/file-replacements"
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  FileCode,
  RefreshCw,
  RotateCcw,
  Send,
  User,
} from "lucide-react"
import Link from "next/link"

type Submission = {
  id: string
  version: string
  drive_link: string
  submitted_by: string
  submitter_name: string
  submitted_at: string
  reviewed_by: string | null
  reviewer_name: string | null
  outcome: string
  remarks: string | null
  designer_notes: string | null
  folder_path: string | null
}

const OUTCOME_BADGE: Record<string, string> = {
  pending:
    "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  approved:
    "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  sent_back: "border-destructive/20 bg-destructive/10 text-destructive",
  reopened_for_revision:
    "border-purple-500/30 bg-purple-500/10 text-purple-600 dark:text-purple-400 font-medium",
  file_replaced:
    "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
}

const OUTCOME_LABEL: Record<string, string> = {
  pending: "Pending Review",
  approved: "Approved",
  sent_back: "Sent Back",
  reopened_for_revision: "Reopened for Client",
  file_replaced: "File Replaced",
}

type TimelineItem =
  | {
      kind: "submission"
      id: string
      at: string
      submission: Submission
      isReopened: boolean
      outcomeKey: string
    }
  | {
      kind: "file_replacement"
      id: string
      at: string
      log: FileReplacementLog
    }

function buildTimelineItems(
  submissions: Submission[],
  fileReplacements: FileReplacementLog[],
  taskStatus: string,
  revisionNotes: string | null
): TimelineItem[] {
  const items: TimelineItem[] = []

  submissions.forEach((sub, idx) => {
    const isReopened =
      sub.outcome === "reopened_for_revision" ||
      (sub.outcome === "approved" &&
        taskStatus !== "ready_for_client" &&
        taskStatus !== "client_ready" &&
        taskStatus !== "closed" &&
        Boolean(revisionNotes) &&
        idx ===
          submissions.findLastIndex(
            (s) => s.outcome === "approved" || s.outcome === "reopened_for_revision"
          ))

    items.push({
      kind: "submission",
      id: sub.id,
      at: sub.submitted_at,
      submission: sub,
      isReopened,
      outcomeKey: isReopened ? "reopened_for_revision" : sub.outcome,
    })
  })

  for (const log of fileReplacements) {
    items.push({
      kind: "file_replacement",
      id: log.id,
      at: log.replaced_at,
      log,
    })
  }

  return items.sort(
    (a, b) => new Date(a.at).getTime() - new Date(b.at).getTime()
  )
}

function TimelineIcon({ item }: { item: TimelineItem }) {
  if (item.kind === "file_replacement") {
    return (
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300">
        <RefreshCw className="h-3.5 w-3.5" />
      </div>
    )
  }

  const outcome = item.outcomeKey
  if (outcome === "approved" || outcome === "reopened_for_revision") {
    return (
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
        <CheckCircle2 className="h-3.5 w-3.5" />
      </div>
    )
  }
  if (outcome === "sent_back") {
    return (
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-destructive/30 bg-destructive/10 text-destructive">
        <RotateCcw className="h-3.5 w-3.5" />
      </div>
    )
  }

  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400">
      <Send className="h-3.5 w-3.5" />
    </div>
  )
}

type Props = {
  taskId: string
  submissions: Submission[]
  fileReplacements: FileReplacementLog[]
  taskStatus: string
  revisionNotes: string | null
  deadline: string | null
}

export function SubmissionHistory({
  taskId,
  submissions,
  fileReplacements,
  taskStatus,
  revisionNotes,
  deadline,
}: Props) {
  const items = buildTimelineItems(
    submissions,
    fileReplacements,
    taskStatus,
    revisionNotes
  )

  if (items.length === 0) return null

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
      <div className="px-5 py-4">
        <h2 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
          Submission History
        </h2>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          Submissions, QC reviews, and file replacements in chronological order
        </p>
      </div>
      <Separator />
      <div className="px-5 py-4">
        <div className="space-y-0">
          {items.map((item, idx) => (
            <div key={item.id} className="relative flex gap-3">
              {idx < items.length - 1 && (
                <span
                  className="absolute left-4 top-8 bottom-0 w-px -translate-x-1/2 bg-border"
                  aria-hidden
                />
              )}

              <div className="relative z-10 pt-0.5">
                <TimelineIcon item={item} />
              </div>

              <div className="min-w-0 flex-1 pb-6 last:pb-0">
                {item.kind === "submission" ? (
                  <SubmissionEntry
                    submission={item.submission}
                    outcomeKey={item.outcomeKey}
                    deadline={deadline}
                  />
                ) : (
                  <FileReplacementEntry taskId={taskId} log={item.log} />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function SubmissionEntry({
  submission: sub,
  outcomeKey,
  deadline,
}: {
  submission: Submission
  outcomeKey: string
  deadline: string | null
}) {
  return (
    <div className="rounded-lg border border-border/80 bg-muted/20 px-3.5 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs font-semibold">{sub.version}</span>
          <Badge
            variant="outline"
            className={`text-xs ${OUTCOME_BADGE[outcomeKey] ?? ""}`}
          >
            {OUTCOME_LABEL[outcomeKey] ?? outcomeKey}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          {isSubmissionLate(sub.submitted_at, deadline) && (
            <Badge
              variant="destructive"
              className="bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30 text-[10px] px-1.5 py-0 font-semibold"
            >
              Submitted Late
            </Badge>
          )}
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            {formatDateTimeDisplay(sub.submitted_at)}
          </p>
        </div>
      </div>

      <p className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground">
        <User className="h-3 w-3 shrink-0" />
        Submitted by {sub.submitter_name}
        {sub.reviewer_name && ` · Reviewed by ${sub.reviewer_name}`}
      </p>

      {(sub.folder_path ||
        (sub.drive_link && !sub.drive_link.startsWith("http"))) && (
        <div className="mt-2">
          <FolderPathLink
            path={sub.folder_path || sub.drive_link}
            label={`Shared Folder Path (${sub.version})`}
          />
        </div>
      )}

      {sub.designer_notes && (
        <div className="mt-2.5 rounded-lg border border-primary/20 bg-primary/8 px-3 py-2.5">
          <p className="text-xs font-semibold text-primary">
            Designer Description / Notes
          </p>
          <p className="mt-0.5 text-xs text-foreground">
            <FormattedTextWithLinks text={sub.designer_notes} />
          </p>
        </div>
      )}

      {sub.remarks && (
        <div className="mt-2.5 rounded-lg border border-destructive/20 bg-destructive/8 px-3 py-2.5">
          <p className="text-xs font-semibold text-destructive">QC Remarks</p>
          <p className="mt-0.5 text-xs text-foreground">
            <FormattedTextWithLinks text={sub.remarks} />
          </p>
        </div>
      )}
    </div>
  )
}

function FileReplacementEntry({
  taskId,
  log,
}: {
  taskId: string
  log: FileReplacementLog
}) {
  const downloadUrl = `/api/tasks/${taskId}/files/download?key=${encodeURIComponent(log.file_key)}`

  return (
    <div className="rounded-lg border border-amber-500/25 bg-amber-500/5 px-3.5 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Badge
          variant="outline"
          className={`text-xs ${OUTCOME_BADGE.file_replaced}`}
        >
          {OUTCOME_LABEL.file_replaced}
        </Badge>
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          {formatDateTimeDisplay(log.replaced_at)}
        </p>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-2 rounded-md border border-amber-500/20 bg-background/60 px-2.5 py-2">
        <FileCode className="h-4 w-4 shrink-0 text-amber-700 dark:text-amber-300" />
        <span className="truncate font-mono text-xs text-muted-foreground max-w-[40%]">
          {log.old_filename || "Previous file"}
        </span>
        <ArrowRight className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
        <Link
          href={downloadUrl}
          className="truncate font-mono text-xs font-medium text-amber-800 dark:text-amber-200 hover:underline max-w-[40%]"
        >
          {log.new_filename || "Updated file"}
        </Link>
      </div>

      <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
        <User className="h-3 w-3 shrink-0" />
        Replaced by {log.replacer_name || log.replaced_by}
      </p>
    </div>
  )
}
