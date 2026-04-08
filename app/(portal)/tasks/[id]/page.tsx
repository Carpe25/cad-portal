import { notFound, redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { sql } from "@/lib/db"
import { extractDriveFolderId, getDriveEmbedUrl } from "@/lib/drive"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { TaskActions } from "./task-actions"
import {
  STATUS_LABELS_FULL as STATUS_LABELS,
  STATUS_COLORS,
  PRIORITY_COLORS,
} from "@/lib/task-utils"
import { PageHeader } from "@/components/portal/page-header"

type Task = {
  id: string
  readable_id: string
  title: string
  client_name: string
  style_ref_number: string | null
  description: string | null
  points: number
  status: string
  priority: string
  deadline: string | null
  drive_folder_link: string | null
  revision_notes: string | null
  assigned_to: string | null
  designer_name: string | null
  created_by: string
  manager_name: string
  created_at: string
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
}

const OUTCOME_BADGE: Record<string, string> = {
  pending:
    "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  approved:
    "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  sent_back: "border-destructive/20 bg-destructive/10 text-destructive",
}

const OUTCOME_LABEL: Record<string, string> = {
  pending: "Pending Review",
  approved: "Approved",
  sent_back: "Sent Back",
}

export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const session = await getSession()
  if (!session) redirect("/login")

  const taskRows = await sql`
    SELECT
      t.*,
      u.name AS designer_name,
      m.name AS manager_name
    FROM tasks t
    LEFT JOIN users u ON t.assigned_to = u.id
    LEFT JOIN users m ON t.created_by = m.id
    WHERE t.id = ${id}
  `

  if (!taskRows.length) notFound()
  const task = taskRows[0] as Task

  const submissions = (await sql`
    SELECT
      s.*,
      su.name AS submitter_name,
      ru.name AS reviewer_name
    FROM submissions s
    LEFT JOIN users su ON s.submitted_by = su.id
    LEFT JOIN users ru ON s.reviewed_by = ru.id
    WHERE s.task_id = ${id}
    ORDER BY s.submitted_at ASC
  `) as Submission[]

  const isManager = session.roles.includes("manager")
  const isQC = session.roles.includes("qc")

  const pendingSubmission = submissions.findLast((s) => s.outcome === "pending")

  const folderId = task.drive_folder_link
    ? extractDriveFolderId(task.drive_folder_link)
    : null
  const embedUrl = folderId ? getDriveEmbedUrl(folderId) : null

  const designers =
    isManager || isQC
      ? ((await sql`SELECT id, name FROM users WHERE active = true AND roles @> ARRAY['designer']::text[] ORDER BY name`) as {
          id: string
          name: string
        }[])
      : []

  const descriptionLine = [
    `Client: ${task.client_name}`,
    task.designer_name ? `Designer: ${task.designer_name}` : null,
  ]
    .filter(Boolean)
    .join(" · ")

  return (
    <main className="min-h-full">
      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <PageHeader
          roleLabel={`${task.readable_id}${task.style_ref_number ? ` · ${task.style_ref_number}` : ""}`}
          title={task.title}
          description={descriptionLine}
          action={
            <div className="flex items-center gap-2">
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
                <div>
                  <dt className="text-xs text-muted-foreground">Points</dt>
                  <dd className="mt-0.5 font-semibold">{task.points} pts</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Deadline</dt>
                  <dd className="mt-0.5 font-medium">
                    {task.deadline
                      ? new Date(task.deadline).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })
                      : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Created by</dt>
                  <dd className="mt-0.5">{task.manager_name}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Created on</dt>
                  <dd className="mt-0.5">
                    {new Date(task.created_at).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </dd>
                </div>
              </dl>
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
            </div>

            {/* Action panel */}
            <TaskActions
              task={{
                id: task.id,
                status: task.status,
                assigned_to: task.assigned_to,
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
                  {submissions.map((sub) => (
                    <div key={sub.id} className="px-5 py-4">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-semibold">
                            {sub.version}
                          </span>
                          <Badge
                            variant="outline"
                            className={`text-xs ${OUTCOME_BADGE[sub.outcome] ?? ""}`}
                          >
                            {OUTCOME_LABEL[sub.outcome] ?? sub.outcome}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {new Date(sub.submitted_at).toLocaleString("en-IN", {
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Submitted by {sub.submitter_name}
                        {sub.reviewer_name &&
                          ` · Reviewed by ${sub.reviewer_name}`}
                      </p>
                      <a
                        href={sub.drive_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1.5 inline-block text-xs text-primary hover:underline"
                      >
                        Open CAD file →
                      </a>
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
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right: Drive Folder Preview */}
          <div className="flex flex-col gap-4">
            <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
              <div className="px-5 py-4">
                <h2 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                  Reference Files
                </h2>
              </div>
              <Separator />
              {embedUrl ? (
                <iframe
                  src={embedUrl}
                  className="h-96 w-full border-0"
                  title="Drive folder preview"
                  allow="autoplay"
                />
              ) : (
                <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
                  <p className="text-sm text-muted-foreground">
                    {task.drive_folder_link
                      ? "Could not parse Drive folder link."
                      : "No Drive folder linked yet."}
                  </p>
                  {task.drive_folder_link && (
                    <a
                      href={task.drive_folder_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary hover:underline"
                    >
                      Open in Drive →
                    </a>
                  )}
                </div>
              )}
              {task.drive_folder_link && embedUrl && (
                <div className="border-t border-border px-4 py-2">
                  <a
                    href={task.drive_folder_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline"
                  >
                    Open folder in Drive →
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
