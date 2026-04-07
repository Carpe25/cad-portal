import { notFound, redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { sql } from "@/lib/db"
import { extractDriveFolderId, getDriveEmbedUrl } from "@/lib/drive"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { TaskActions } from "./task-actions"

const STATUS_LABELS: Record<string, string> = {
  assigned: "Assigned",
  in_progress: "In Progress",
  in_qc_review: "In QC Review",
  revision_requested: "Revision Requested",
  client_ready: "Client Ready",
  closed: "Closed",
}

const STATUS_COLORS: Record<string, string> = {
  assigned: "bg-secondary text-secondary-foreground",
  in_progress: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  in_qc_review: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  revision_requested: "bg-destructive/10 text-destructive",
  client_ready: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  closed: "bg-secondary text-muted-foreground",
}

const PRIORITY_COLORS: Record<string, string> = {
  high: "bg-red-500/10 text-red-600 dark:text-red-400",
  medium: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  low: "bg-secondary text-muted-foreground",
}

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
  const isAssignedDesigner = task.assigned_to === session.id

  // Latest pending submission (for QC actions)
  const pendingSubmission = submissions.findLast((s) => s.outcome === "pending")

  // Drive embed
  const folderId = task.drive_folder_link
    ? extractDriveFolderId(task.drive_folder_link)
    : null
  const embedUrl = folderId ? getDriveEmbedUrl(folderId) : null

  // Get all designers for reassignment (manager + qc)
  const designers = (isManager || isQC)
    ? ((await sql`SELECT id, name FROM users WHERE active = true AND roles @> ARRAY['designer']::text[] ORDER BY name`) as { id: string; name: string }[])
    : []

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-xs text-muted-foreground">
            {task.readable_id}
            {task.style_ref_number && ` · ${task.style_ref_number}`}
          </p>
          <h1 className="font-heading mt-1 text-2xl font-semibold">
            {task.title}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Client: <span className="font-medium text-foreground">{task.client_name}</span>
            {task.designer_name && (
              <>
                {" · "}Designer:{" "}
                <span className="font-medium text-foreground">
                  {task.designer_name}
                </span>
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${PRIORITY_COLORS[task.priority] ?? ""}`}
          >
            {task.priority}
          </span>
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[task.status] ?? ""}`}
          >
            {STATUS_LABELS[task.status] ?? task.status}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left: Details + Actions */}
        <div className="flex flex-col gap-4 lg:col-span-2">
          {/* Meta card */}
          <div className="rounded-xl border border-border bg-card p-4">
            <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Task Details
            </h2>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <div>
                <dt className="text-muted-foreground">Points</dt>
                <dd className="font-semibold">{task.points} pts</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Deadline</dt>
                <dd className="font-medium">
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
                <dt className="text-muted-foreground">Created by</dt>
                <dd>{task.manager_name}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Created on</dt>
                <dd>
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
                <Separator className="my-3" />
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {task.description}
                </p>
              </>
            )}
            {task.revision_notes && (
              <>
                <Separator className="my-3" />
                <div className="rounded-lg bg-amber-500/10 px-3 py-2">
                  <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
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
                ? { id: pendingSubmission.id, drive_link: pendingSubmission.drive_link }
                : null
            }
            designers={designers}
            currentPoints={task.points}
          />

          {/* Version History */}
          {submissions.length > 0 && (
            <div className="rounded-xl border border-border bg-card">
              <div className="px-4 py-3">
                <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Submission History
                </h2>
              </div>
              <Separator />
              <div className="divide-y divide-border">
                {submissions.map((sub, idx) => (
                  <div key={sub.id} className="px-4 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-semibold">
                          {sub.version}
                        </span>
                        {sub.outcome === "pending" && (
                          <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs text-amber-600 dark:text-amber-400">
                            Pending Review
                          </span>
                        )}
                        {sub.outcome === "approved" && (
                          <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-600 dark:text-emerald-400">
                            Approved
                          </span>
                        )}
                        {sub.outcome === "sent_back" && (
                          <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs text-destructive">
                            Sent Back
                          </span>
                        )}
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
                      {sub.reviewer_name && ` · Reviewed by ${sub.reviewer_name}`}
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
                      <div className="mt-2 rounded-lg bg-destructive/10 px-3 py-2">
                        <p className="text-xs font-medium text-destructive">
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
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="px-4 py-3">
              <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
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
              <div className="flex flex-col items-center gap-2 py-10 text-center px-4">
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
  )
}
