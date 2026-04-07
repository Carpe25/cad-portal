import Link from "next/link"
import { getSession } from "@/lib/session"
import { redirect } from "next/navigation"
import { sql } from "@/lib/db"
import { DriveLink } from "./drive-link"

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

const PRIORITY_COLORS: Record<string, string> = {
  high: "bg-red-500/10 text-red-600 dark:text-red-400",
  medium: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  low: "bg-secondary text-muted-foreground",
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
      <div className="mb-6">
        <h1 className="font-heading text-xl font-semibold">QC Queue</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {items.length} submission{items.length !== 1 ? "s" : ""} awaiting
          review. Open a task to approve or send back.
        </p>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card py-16 text-center">
          <svg
            className="h-8 w-8 text-muted-foreground/40"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <p className="text-sm text-muted-foreground">
            All clear — no pending reviews
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <Link
              key={item.submission_id}
              href={`/tasks/${item.task_id}`}
              className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:bg-accent"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-mono text-xs text-muted-foreground">
                    {item.readable_id} · {item.version}
                  </p>
                  <p className="mt-0.5 font-medium leading-tight">{item.title}</p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium capitalize ${PRIORITY_COLORS[item.priority] ?? ""}`}
                >
                  {item.priority}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Client: {item.client_name}</span>
                <span>by {item.designer_name}</span>
              </div>

              <div className="flex items-center justify-between">
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
