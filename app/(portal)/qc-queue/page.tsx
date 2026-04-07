import Link from "next/link"
import { getSession } from "@/lib/session"
import { redirect } from "next/navigation"
import { sql } from "@/lib/db"
import { DriveLink } from "./drive-link"
import { PRIORITY_COLORS } from "@/lib/task-utils"
import { CheckCircle2 } from "lucide-react"

type QueueItem = {
  task_id: string
  readable_id: string
  title: string
  client_name: string
  priority: string
  designer_name: string
  submission_id: string
  version: string
  drive_link: string
  submitted_at: string
}

export default async function QCQueuePage() {
  const session = await getSession()
  if (!session) redirect("/login")

  const isQC = session.roles.includes("qc")
  const isManager = session.roles.includes("manager")
  if (!isQC && !isManager) redirect("/dashboard")

  const items = (await sql`
    SELECT
      t.id AS task_id,
      t.readable_id,
      t.title,
      t.client_name,
      t.priority,
      u.name AS designer_name,
      s.id AS submission_id,
      s.version,
      s.drive_link,
      s.submitted_at
    FROM tasks t
    JOIN submissions s ON s.task_id = t.id AND s.outcome = 'pending'
    LEFT JOIN users u ON t.assigned_to = u.id
    WHERE t.status = 'in_qc_review'
    ORDER BY
      CASE t.priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
      s.submitted_at ASC
  `) as QueueItem[]

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-heading text-xl font-semibold">QC Queue</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {items.length > 0
              ? `${items.length} submission${items.length !== 1 ? "s" : ""} awaiting review — open a task to act.`
              : "No pending reviews right now."}
          </p>
        </div>
        {items.length > 0 && (
          <span className="rounded-full bg-amber-500/10 px-3 py-1 text-sm font-medium text-amber-600 dark:text-amber-400">
            {items.length} pending
          </span>
        )}
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card py-20 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10">
            <CheckCircle2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <p className="font-medium">All clear</p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              No pending QC reviews
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((item, idx) => (
            <Link
              key={item.submission_id}
              href={`/tasks/${item.task_id}`}
              className="group flex flex-col gap-4 rounded-xl border border-border bg-card p-5 shadow-xs transition-all hover:border-primary/30 hover:shadow-sm"
            >
              {/* Header row */}
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                      {idx + 1}
                    </span>
                    <p className="font-mono text-xs text-muted-foreground">
                      {item.readable_id} · {item.version}
                    </p>
                  </div>
                  <p className="mt-1.5 font-medium leading-snug group-hover:text-primary">
                    {item.title}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium capitalize ${PRIORITY_COLORS[item.priority] ?? ""}`}
                >
                  {item.priority}
                </span>
              </div>

              {/* Meta */}
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="truncate">{item.client_name}</span>
                <span className="shrink-0 pl-2">by {item.designer_name}</span>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between border-t border-border/60 pt-3">
                <DriveLink href={item.drive_link} />
                <span className="text-xs text-muted-foreground">
                  {new Date(item.submitted_at).toLocaleString("en-IN", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
