import { notFound, redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { sql } from "@/lib/db"
import { extractDriveFolderId, getDriveEmbedUrl } from "@/lib/drive"
import { listTaskFiles, createTaskFolderInStorage } from "@/lib/linode-storage"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { TaskActions } from "./task-actions"
import Link from "next/link"
import { Pencil, Download, FileCode } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  STATUS_LABELS_FULL as STATUS_LABELS,
  STATUS_COLORS,
  PRIORITY_COLORS,
  labelBadgeClass,
  isTaskOverdue,
  isSubmissionLate,
  formatDateDisplay,
  formatDateTimeDisplay,
} from "@/lib/task-utils"
import { ParsedTrelloCard } from "@/lib/trello-types"
import { PageHeader } from "@/components/portal/page-header"
import { FolderPathLink } from "@/components/folder-path-link"
import { DeadlineCountdown } from "@/components/portal/deadline-countdown"

type Task = {
  id: string
  readable_id: string
  title: string
  client_name: string
  customer_project_no: string | null
  speed: string | null
  customer_code: string | null
  category_code: string | null
  complexity: string | null
  work_type: string | null
  sr_no: string | null
  cd_project_no: string | null
  request_date: string | null
  reference_image: string | null
  style_ref_number: string | null
  description: string | null
  points: number
  status: string
  priority: string
  deadline: string | null
  drive_folder_link: string | null
  revision_notes: string | null
  assigned_to: string | null
  assigned_at: string | null
  designer_name: string | null
  created_by: string
  manager_name: string
  created_at: string
  trello_data: ParsedTrelloCard | null
}

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
}

const OUTCOME_LABEL: Record<string, string> = {
  pending: "Pending Review",
  approved: "Approved",
  sent_back: "Sent Back",
  reopened_for_revision: "Reopened for Client",
}

export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const session = await getSession()
  if (!session) redirect("/login")

  const cleanId = id.trim()
  const taskRows = await sql`
    SELECT
      t.*,
      u.name AS designer_name,
      m.name AS manager_name
    FROM tasks t
    LEFT JOIN users u ON t.assigned_to = u.id
    LEFT JOIN users m ON t.created_by = m.id
    WHERE LOWER(t.id::text) = LOWER(${cleanId})
       OR LOWER(t.readable_id) = LOWER(${cleanId})
       OR REPLACE(t.id::text, '-', '') = LOWER(REPLACE(${cleanId}, '-', ''))
  `

  if (!taskRows.length) notFound()
  const task = taskRows[0] as Task
  const trelloData = task.trello_data

  const submissions = (await sql`
    SELECT
      s.*,
      su.name AS submitter_name,
      ru.name AS reviewer_name
    FROM submissions s
    LEFT JOIN users su ON s.submitted_by = su.id
    LEFT JOIN users ru ON s.reviewed_by = ru.id
    WHERE s.task_id::text = ${task.id}::text
    ORDER BY s.submitted_at ASC
  `) as Submission[]

  const isManager = session.roles.includes("manager")
  const isQC = session.roles.includes("qc")

  const pendingSubmission = submissions.findLast((s) => s.outcome === "pending")

  const folderId = task.drive_folder_link
    ? extractDriveFolderId(task.drive_folder_link)
    : null
  const embedUrl = folderId ? getDriveEmbedUrl(folderId) : null

  let linodeFiles = await listTaskFiles(task.id)
  if (linodeFiles.length === 0) {
    await createTaskFolderInStorage(task.id, task.customer_project_no || task.title)
    linodeFiles = await listTaskFiles(task.id)
  }

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const designers =
    isManager || isQC
      ? ((await sql`SELECT id, name FROM users WHERE active = true AND roles @> ARRAY['designer']::text[] ORDER BY name`) as {
        id: string
        name: string
      }[])
      : []

  const canSeeCustomerName = isManager || isQC
  const taskHeading = task.customer_project_no || task.title

  const customerLabel = canSeeCustomerName
    ? `Client: ${task.client_name}`
    : `Customer Code: ${task.customer_code ?? "—"}`

  const descriptionLine = [
    task.cd_project_no ? `CD Project No: ${task.cd_project_no}` : null,
    customerLabel,
    task.designer_name ? `Designer: ${task.designer_name}` : null,
  ]
    .filter(Boolean)
    .join(" · ")

  return (
    <main className="min-h-full">
      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <PageHeader
          roleLabel={task.customer_project_no ? `Customer Project: ${task.customer_project_no}` : (task.cd_project_no || task.readable_id)}
          title={taskHeading}
          description={descriptionLine}
          action={
            <div className="flex items-center gap-2">
              {isManager && (
                <Button asChild variant="outline" size="sm" className="gap-1.5 text-xs">
                  <Link href={`/tasks/${task.id}/edit`}>
                    <Pencil className="h-3.5 w-3.5" />
                    Edit Task
                  </Link>
                </Button>
              )}
              <Badge
                variant="outline"
                className={`capitalize ${PRIORITY_COLORS[task.priority] ?? ""}`}
              >
                {task.priority}
              </Badge>
              <Badge
                variant="outline"
                className={STATUS_COLORS[task.status] ?? ""}
              >
                {STATUS_LABELS[task.status] ?? task.status}
              </Badge>
            </div>
          }
        />

        <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Left: Details + Actions */}
          <div className="flex flex-col gap-4 lg:col-span-2">
            {/* Meta card */}
            <div className="rounded-xl border border-border bg-card p-5 shadow-xs">
              <h2 className="mb-4 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                Task Details
              </h2>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm sm:grid-cols-4">
                {canSeeCustomerName ? (
                  <div>
                    <dt className="text-xs text-muted-foreground">Customer</dt>
                    <dd className="mt-0.5 font-medium">{task.client_name}</dd>
                  </div>
                ) : (
                  <div>
                    <dt className="text-xs text-muted-foreground">Customer Code</dt>
                    <dd className="mt-0.5 font-mono font-medium">{task.customer_code ?? "—"}</dd>
                  </div>
                )}
                {canSeeCustomerName && task.customer_code && (
                  <div>
                    <dt className="text-xs text-muted-foreground">Customer Code</dt>
                    <dd className="mt-0.5 font-mono font-medium">{task.customer_code}</dd>
                  </div>
                )}
                {task.cd_project_no && (
                  <div>
                    <dt className="text-xs text-muted-foreground">CD Project No.</dt>
                    <dd className="mt-0.5 font-mono font-bold text-primary">
                      {task.cd_project_no}
                    </dd>
                  </div>
                )}
                {task.customer_project_no && (
                  <div>
                    <dt className="text-xs text-muted-foreground">Customer Project No.</dt>
                    <dd className="mt-0.5 font-medium">{task.customer_project_no}</dd>
                  </div>
                )}
                {task.speed && (
                  <div>
                    <dt className="text-xs text-muted-foreground">Speed</dt>
                    <dd className="mt-0.5 font-semibold">
                      {task.speed === "U" ? "U (Urgent)" : "N (Normal)"}
                    </dd>
                  </div>
                )}
                {task.category_code && (
                  <div>
                    <dt className="text-xs text-muted-foreground">Category</dt>
                    <dd className="mt-0.5 font-semibold">{task.category_code}</dd>
                  </div>
                )}
                {task.complexity && (
                  <div>
                    <dt className="text-xs text-muted-foreground">Complexity</dt>
                    <dd className="mt-0.5 font-semibold">{task.complexity}</dd>
                  </div>
                )}
                {task.work_type && (
                  <div>
                    <dt className="text-xs text-muted-foreground">Work Type</dt>
                    <dd className="mt-0.5 font-medium">{task.work_type}</dd>
                  </div>
                )}
                {task.request_date && (
                  <div>
                    <dt className="text-xs text-muted-foreground">Request Date</dt>
                    <dd className="mt-0.5 font-medium">
                      {formatDateDisplay(task.request_date, {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </dd>
                  </div>
                )}
                <div>
                  <dt className="text-xs text-muted-foreground">Points</dt>
                  <dd className="mt-0.5 font-semibold">{task.points} pts</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Deadline</dt>
                  <dd className="mt-1 flex flex-wrap items-center gap-2">
                    <DeadlineCountdown deadline={task.deadline} status={task.status} />
                    {task.deadline && (
                      <span className="text-xs text-muted-foreground font-semibold">
                        ({formatDateDisplay(task.deadline, {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })})
                      </span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Created by</dt>
                  <dd className="mt-0.5">{task.manager_name}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Created at</dt>
                  <dd className="mt-0.5 font-medium text-xs">
                    {formatDateTimeDisplay(task.created_at)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Assigned at</dt>
                  <dd className="mt-0.5 font-medium text-xs">
                    {task.assigned_at ? formatDateTimeDisplay(task.assigned_at) : "Unassigned"}
                  </dd>
                </div>
              </dl>

              {/* Reference Image display (Single or Multiple) */}
              {(() => {
                if (!task.reference_image) return null
                let images: string[] = []
                try {
                  if (task.reference_image.trim().startsWith("[")) {
                    images = JSON.parse(task.reference_image)
                  } else {
                    images = [task.reference_image]
                  }
                } catch {
                  images = [task.reference_image]
                }
                if (images.length === 0) return null

                return (
                  <>
                    <Separator className="my-4" />
                    <div className="flex flex-col gap-2">
                      <span className="text-xs font-semibold text-muted-foreground tracking-wide uppercase">
                        Reference Image{images.length > 1 ? `s (${images.length})` : ""}
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {images.map((imgUrl, idx) => (
                          <a
                            key={idx}
                            href={imgUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group relative overflow-hidden rounded-lg border border-border bg-muted/30 p-1 hover:border-primary/50 transition-colors"
                          >
                            <img
                              src={imgUrl}
                              alt={`Reference ${idx + 1}`}
                              className="max-h-64 w-full rounded object-contain transition-transform duration-200 group-hover:scale-105"
                            />
                          </a>
                        ))}
                      </div>
                    </div>
                  </>
                )
              })()}
              {task.description && (
                <>
                  <Separator className="my-4" />
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {task.description}
                  </p>
                </>
              )}
              {task.revision_notes && (
                <>
                  <Separator className="my-4" />
                  <div className="rounded-lg border border-amber-500/20 bg-amber-500/8 px-4 py-3">
                    <p className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                      Client Revision Notes
                    </p>
                    <p className="mt-1 text-sm text-foreground">
                      {task.revision_notes}
                    </p>
                  </div>
                </>
              )}
              {trelloData && (
                <>
                  <Separator className="my-4" />
                  <div className="flex flex-col gap-4">
                    <h4 className="text-sm font-semibold text-muted-foreground tracking-wide uppercase">
                      Trello Card Details
                    </h4>

                    {/* Board + List */}
                    <div className="grid grid-cols-2 gap-4">
                      {trelloData.boardName && (
                        <div className="flex flex-col gap-1.5">
                          <span className="text-xs text-muted-foreground">Board</span>
                          <p className="text-sm font-medium">{trelloData.boardName}</p>
                        </div>
                      )}
                      {trelloData.listName && (
                        <div className="flex flex-col gap-1.5">
                          <span className="text-xs text-muted-foreground">Current List</span>
                          <p className="text-sm font-medium">{trelloData.listName}</p>
                        </div>
                      )}
                    </div>

                    {/* Status */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex flex-col gap-1.5">
                        <span className="text-xs text-muted-foreground">Card Status</span>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="secondary"
                            className={
                              trelloData.closed
                                ? "bg-zinc-500/15 text-zinc-600"
                                : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                            }
                          >
                            {trelloData.closed ? "Archived" : "Open"}
                          </Badge>
                          {trelloData.dueComplete && (
                            <Badge
                              variant="secondary"
                              className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                            >
                              Due Complete
                            </Badge>
                          )}
                        </div>
                      </div>
                      {trelloData.dateLastActivity && (
                        <div className="flex flex-col gap-1.5">
                          <span className="text-xs text-muted-foreground">Last Activity</span>
                          <p className="text-sm">
                            {new Date(trelloData.dateLastActivity).toLocaleDateString("en-US", {
                              year: "numeric",
                              month: "long",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Labels */}
                    {trelloData.labels.length > 0 && (
                      <div className="flex flex-col gap-1.5">
                        <span className="text-xs text-muted-foreground">Labels</span>
                        <div className="flex flex-wrap gap-1.5">
                          {trelloData.labels.map((label) => (
                            <Badge
                              key={label.id}
                              variant="secondary"
                              className={labelBadgeClass(label.color)}
                            >
                              {label.name}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Members */}
                    {trelloData.members.length > 0 && (
                      <div className="flex flex-col gap-1.5">
                        <span className="text-xs text-muted-foreground">Members</span>
                        <div className="flex flex-wrap gap-2">
                          {trelloData.members.map((m) => (
                            <div
                              key={m.id}
                              className="flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 text-xs"
                            >
                              <div className="h-5 w-5 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-semibold text-primary">
                                {m.fullName
                                  .split(" ")
                                  .map((n) => n[0])
                                  .join("")
                                  .slice(0, 2)
                                  .toUpperCase()}
                              </div>
                              <span>{m.fullName}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Custom Fields */}
                    {trelloData.customFields.length > 0 && (
                      <div className="flex flex-col gap-1.5">
                        <span className="text-xs text-muted-foreground">Custom Fields</span>
                        <div className="grid grid-cols-2 gap-3">
                          {trelloData.customFields.map((cf) => (
                            <div
                              key={cf.id}
                              className="rounded-md border bg-muted/30 px-3 py-2"
                            >
                              <p className="text-xs text-muted-foreground font-medium">
                                {cf.fieldName}
                              </p>
                              <p className="text-sm mt-0.5">{cf.value || "—"}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Checklists */}
                    {trelloData.checklists.length > 0 && (
                      <div className="flex flex-col gap-2">
                        <span className="text-xs text-muted-foreground">Checklists</span>
                        {trelloData.checklists.map((cl) => (
                          <div
                            key={cl.id}
                            className="rounded-md border bg-muted/30 px-3 py-2"
                          >
                            <p className="text-xs font-semibold mb-1.5">{cl.name}</p>
                            <ul className="space-y-1">
                              {cl.checkItems.map((ci) => (
                                <li key={ci.id} className="flex items-center gap-2 text-xs">
                                  <span
                                    className={`inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border ${ci.state === "complete"
                                        ? "bg-emerald-500 border-emerald-500 text-white"
                                        : "border-muted-foreground/30"
                                      }`}
                                  >
                                    {ci.state === "complete" && (
                                      <svg
                                        className="h-2.5 w-2.5"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        strokeWidth={3}
                                        stroke="currentColor"
                                      >
                                        <path
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          d="M4.5 12.75l6 6 9-13.5"
                                        />
                                      </svg>
                                    )}
                                  </span>
                                  <span
                                    className={
                                      ci.state === "complete"
                                        ? "line-through text-muted-foreground"
                                        : ""
                                    }
                                  >
                                    {ci.name}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Attachments */}
                    {trelloData.attachments.length > 0 && (
                      <div className="flex flex-col gap-1.5">
                        <span className="text-xs text-muted-foreground">
                          Attachments ({trelloData.attachments.length})
                        </span>
                        <div className="space-y-1.5">
                          {trelloData.attachments.map((att) => (
                            <a
                              key={att.id}
                              href={att.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-xs hover:bg-muted/60 transition-colors"
                            >
                              <svg
                                className="h-4 w-4 text-muted-foreground shrink-0"
                                fill="none"
                                viewBox="0 0 24 24"
                                strokeWidth={1.5}
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13"
                                />
                              </svg>
                              <span className="truncate text-primary font-medium">
                                {att.name}
                              </span>
                              <span className="ml-auto text-muted-foreground shrink-0">
                                {formatDateDisplay(att.date, { day: "numeric", month: "long", year: "numeric" })}
                              </span>
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Trello Link */}
                    {trelloData.url && (
                      <div className="flex flex-col gap-1.5">
                        <span className="text-xs text-muted-foreground">Trello Card Link</span>
                        <a
                          href={trelloData.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-primary hover:underline truncate"
                        >
                          {trelloData.url}
                        </a>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Action panel */}
            <TaskActions
              task={{
                id: task.id,
                status: task.status,
                assigned_to: task.assigned_to,
                drive_folder_link: task.drive_folder_link,
              }}
              session={{
                id: session.id,
                roles: session.roles,
              }}
              pendingSubmission={
                pendingSubmission
                  ? {
                    id: pendingSubmission.id,
                    drive_link: pendingSubmission.drive_link,
                  }
                  : null
              }
              designers={designers}
              currentPoints={task.points}
            />

            {/* Version History */}
            {submissions.length > 0 && (
              <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
                <div className="px-5 py-4">
                  <h2 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                    Submission History
                  </h2>
                </div>
                <Separator />
                <div className="divide-y divide-border">
                  {submissions.map((sub, idx) => {
                    const isReopened =
                      sub.outcome === "reopened_for_revision" ||
                      (sub.outcome === "approved" &&
                        task.status !== "client_ready" &&
                        task.status !== "closed" &&
                        Boolean(task.revision_notes) &&
                        idx === submissions.findLastIndex((s) => s.outcome === "approved" || s.outcome === "reopened_for_revision"))
                    const outcomeKey = isReopened ? "reopened_for_revision" : sub.outcome

                    return (
                      <div key={sub.id} className="px-5 py-4">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-semibold">
                              {sub.version}
                            </span>
                            <Badge
                              variant="outline"
                              className={`text-xs ${OUTCOME_BADGE[outcomeKey] ?? ""}`}
                            >
                              {OUTCOME_LABEL[outcomeKey] ?? outcomeKey}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2">
                            {isSubmissionLate(sub.submitted_at, task.deadline) && (
                              <Badge variant="destructive" className="bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30 text-[10px] px-1.5 py-0 font-semibold">
                                Submitted Late
                              </Badge>
                            )}
                            <p className="text-xs text-muted-foreground">
                              {new Date(sub.submitted_at).toLocaleString("en-IN", {
                                day: "numeric",
                                month: "long",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </p>
                          </div>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Submitted by {sub.submitter_name}
                        {sub.reviewer_name &&
                          ` · Reviewed by ${sub.reviewer_name}`}
                      </p>
                      {sub.drive_link && sub.drive_link.startsWith("http") && (
                        <a
                          href={sub.drive_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1.5 inline-block text-xs text-primary hover:underline"
                        >
                          Open CAD file / Link →
                        </a>
                      )}
                      {(sub.folder_path || (sub.drive_link && !sub.drive_link.startsWith("http"))) && (
                        <div className="mt-2">
                          <FolderPathLink
                            path={sub.folder_path || sub.drive_link}
                            label={`Shared Folder Path (${sub.version})`}
                          />
                        </div>
                      )}
                      {sub.designer_notes && (
                        <div className="mt-2.5 rounded-lg border border-primary/20 bg-primary/8 px-3.5 py-2.5">
                          <p className="text-xs font-semibold text-primary">
                            Designer Description / Notes
                          </p>
                          <p className="mt-0.5 text-xs text-foreground">
                            {sub.designer_notes}
                          </p>
                        </div>
                      )}
                      {sub.remarks && (
                        <div className="mt-2.5 rounded-lg border border-destructive/20 bg-destructive/8 px-3.5 py-2.5">
                          <p className="text-xs font-semibold text-destructive">
                            QC Remarks
                          </p>
                          <p className="mt-0.5 text-xs text-foreground">
                            {sub.remarks}
                          </p>
                        </div>
                      )}
                    </div>
                  )})}
                </div>
              </div>
            )}
          </div>

          {/* Right: Linode CAD & Task Files */}
          <div className="flex flex-col gap-4">
            <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
              <div className="px-5 py-4 flex items-center justify-between">
                <div>
                  <h2 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                    Linode CAD & Task Files
                  </h2>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Bucket folder: <code className="font-mono text-foreground">tasks/{task.id}/</code>
                  </p>
                </div>
                <Badge variant="secondary" className="text-[10px] font-mono font-semibold">
                  {linodeFiles.length} file{linodeFiles.length !== 1 ? "s" : ""}
                </Badge>
              </div>
              <Separator />

              {linodeFiles.length > 0 ? (
                <div className="divide-y divide-border">
                  {linodeFiles.map((file) => {
                    const downloadUrl = `/api/tasks/${task.id}/files/download?key=${encodeURIComponent(file.key)}`
                    const isCad =
                      file.filename.endsWith(".3dm") ||
                      file.filename.endsWith(".stl") ||
                      file.filename.endsWith(".stp") ||
                      file.filename.endsWith(".step") ||
                      file.filename.endsWith(".zip")
                    return (
                      <div
                        key={file.key}
                        className="px-5 py-3.5 flex items-center justify-between gap-3 hover:bg-muted/20 transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`p-2 rounded-lg shrink-0 ${
                              isCad
                                ? "bg-primary/10 text-primary"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            <FileCode className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <p
                              className="text-xs font-medium text-foreground truncate"
                              title={file.filename}
                            >
                              {file.filename}
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              {formatFileSize(file.size)}
                              {file.lastModified &&
                                ` · ${new Date(file.lastModified).toLocaleDateString("en-IN")}`}
                            </p>
                          </div>
                        </div>

                        <a
                          href={downloadUrl}
                          download
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors shrink-0 shadow-2xs"
                        >
                          <Download className="h-3.5 w-3.5" />
                          Download
                        </a>
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

            {/* Optional Legacy Google Drive Preview */}
            {embedUrl && (
              <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
                <div className="px-5 py-3.5 border-b border-border">
                  <h3 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                    Legacy Google Drive Folder
                  </h3>
                </div>
                <iframe
                  src={embedUrl}
                  className="h-80 w-full border-0"
                  title="Drive folder preview"
                  allow="autoplay"
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
