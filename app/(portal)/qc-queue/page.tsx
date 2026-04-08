import Link from "next/link"
import { Suspense } from "react"
import { getSession } from "@/lib/session"
import { redirect } from "next/navigation"
import { sql } from "@/lib/db"
import { DriveLink } from "./drive-link"
import { PRIORITY_COLORS } from "@/lib/task-utils"
import { CheckCircle2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/components/portal/page-header"
import { EmptyState } from "@/components/portal/empty-state"

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

  return (
    <main className="min-h-full">
      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <PageHeader
          roleLabel="QC"
          title="QC Queue"
          description="Submissions awaiting review — open a task to act."
        />
        <Suspense fallback={<QCQueueSkeleton />}>
          <QCQueueContent />
        </Suspense>
      </div>
    </main>
  )
}

async function QCQueueContent() {
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

  if (items.length === 0) {
    return (
      <div className="mt-8">
        <EmptyState
          icon={CheckCircle2}
          title="All clear"
          description="No pending QC reviews."
        />
      </div>
    )
  }

  return (
    <div className="mt-8 space-y-8">
      {/* Count badge */}
      <div className="flex items-center gap-2">
        <Badge
          variant="outline"
          className="border-amber-500/20 bg-amber-500/10 py-1 text-sm text-amber-600 dark:text-amber-400"
        >
          {items.length} pending
        </Badge>
      </div>

      {/* Queue grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
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
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-border/50 bg-muted text-xs font-semibold text-muted-foreground">
                    {idx + 1}
                  </span>
                  <p className="font-mono text-xs text-muted-foreground">
                    {item.readable_id} · {item.version}
                  </p>
                </div>
                <p className="mt-1.5 leading-snug font-medium transition-colors group-hover:text-primary">
                  {item.title}
                </p>
              </div>
              <Badge
                variant="outline"
                className={`shrink-0 capitalize ${PRIORITY_COLORS[item.priority] ?? ""}`}
              >
                {item.priority}
              </Badge>
            </div>

            {/* Meta */}
            <div className="flex items-center justify-between rounded-lg bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              <span className="truncate">{item.client_name}</span>
              <span className="shrink-0 rounded border border-border/40 bg-background px-2 py-0.5 pl-2 font-medium shadow-xs">
                by {item.designer_name}
              </span>
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
    </div>
  )
}

function QCQueueSkeleton() {
  return (
    <div className="mt-8 space-y-8">
      <Skeleton className="h-7 w-24 rounded-full" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-48 w-full rounded-xl" />
        ))}
      </div>
    </div>
  )
}
