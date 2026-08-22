import Link from "next/link"
import { Suspense } from "react"
import { redirect } from "next/navigation"
import { PlusSquare } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { sql } from "@/lib/db"
import { getSession, type SessionUser } from "@/lib/session"
import { TasksSearchWorkspace, type Task } from "@/components/portal/tasks-search-workspace"

// --- Page ---
export default async function TasksPage() {
  const session = await getSession()
  if (!session) redirect("/login")

  const canManage =
    session.roles.includes("manager") || session.roles.includes("qc")
  const roleLabel = session.roles.includes("manager")
    ? "Manager"
    : session.roles.includes("qc")
      ? "QC"
      : "Designer"

  return (
    <main className="min-h-full">
      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <TasksHeader
          firstName={session.name.split(" ")[0] ?? session.name}
          roleLabel={roleLabel}
          canManage={canManage}
        />
        <Suspense fallback={<TasksPageSkeleton canManage={canManage} />}>
          <TasksWorkspace session={session} canManage={canManage} />
        </Suspense>
      </div>
    </main>
  )
}

// --- Workspace (async, streamed) ---
async function TasksWorkspace({
  session,
  canManage,
}: {
  session: SessionUser
  canManage: boolean
}) {
  const allTasks = (await sql`
    SELECT t.id, t.readable_id, t.title, t.customer_project_no, t.cd_project_no, t.speed, t.client_name, t.customer_code, t.status,
           t.priority, t.deadline, t.points, t.created_at,
           u.name AS designer_name,
           (t.assigned_to = ${session.id}) AS is_mine,
           (t.assigned_to IS NULL) AS is_unassigned
    FROM tasks t
    LEFT JOIN users u ON t.assigned_to = u.id
    WHERE
      (${canManage}::boolean = true)
      OR (t.assigned_to IS NULL)
      OR (t.assigned_to = ${session.id})
    ORDER BY
      CASE t.status
        WHEN 'revision_requested' THEN 0
        WHEN 'assigned'           THEN 1
        WHEN 'in_progress'        THEN 2
        WHEN 'in_qc_review'       THEN 3
        WHEN 'ready_for_client'   THEN 4
        WHEN 'client_ready'       THEN 5
        ELSE 6
      END,
      CASE t.priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
      t.deadline ASC NULLS LAST
  `) as Task[]

  return <TasksSearchWorkspace allTasks={allTasks} canManage={canManage} />
}

// --- Header ---
function TasksHeader({
  firstName,
  roleLabel,
  canManage,
}: {
  firstName: string
  roleLabel: string
  canManage: boolean
}) {
  return (
    <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium tracking-widest text-muted-foreground uppercase">
            {roleLabel}
          </span>
          <span className="text-xs text-muted-foreground/40">·</span>
          <span className="text-xs text-muted-foreground">Tasks</span>
        </div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Keep delivery moving, {firstName}
        </h1>
        <p className="text-sm text-muted-foreground">
          Active assignments, open queues, and team velocity — all in one place.
        </p>
      </div>
      {canManage && (
        <Button asChild size="sm" className="self-start sm:self-auto">
          <Link href="/tasks/new">
            <PlusSquare className="mr-1.5 h-4 w-4" />
            New task
          </Link>
        </Button>
      )}
    </div>
  )
}

// --- Skeleton ---
function TasksPageSkeleton({ canManage }: { canManage: boolean }) {
  return (
    <div className="mt-8 space-y-8">
      {/* Stats skeleton */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-4">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="mt-3 h-8 w-12" />
            <Skeleton className="mt-1.5 h-3 w-16" />
          </div>
        ))}
      </div>

      {/* Main layout skeleton */}
      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-10">
          {[180, 280, ...(canManage ? [180] : [])].map((h, i) => (
            <div key={i} className="space-y-3">
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-5 w-6 rounded-full" />
              </div>
              <Skeleton className={`w-full rounded-xl`} style={{ height: h }} />
            </div>
          ))}
        </div>
        <div className="space-y-4">
          <Skeleton className="h-36 w-full rounded-xl" />
          <Skeleton className="h-44 w-full rounded-xl" />
        </div>
      </div>
    </div>
  )
}
