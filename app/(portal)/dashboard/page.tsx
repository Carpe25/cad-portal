import Link from "next/link"
import { Suspense } from "react"
import { getSession } from "@/lib/session"
import { redirect } from "next/navigation"
import { sql } from "@/lib/db"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { STATUS_LABELS, STATUS_COLORS, PRIORITY_COLORS, SPEED_COLORS } from "@/lib/task-utils"
import {
  ArrowRight,
  Clock,
  Timer,
  ShieldCheck,
  CheckCircle2,
  Users,
  ListTodo,
  Eye,
  Zap,
  type LucideIcon,
} from "lucide-react"
import { PageHeader } from "@/components/portal/page-header"
import { StatCard } from "@/components/portal/stat-card"
import { EmptyState } from "@/components/portal/empty-state"

type Task = {
  id: string
  readable_id: string
  title: string
  customer_project_no: string | null
  cd_project_no: string | null
  speed: string | null
  status: string
  priority: string
  deadline: string | null
  designer_name?: string
}

type Stat = {
  label: string
  value: string | number
  note: string
  icon: LucideIcon
  accent: string
}

export default async function DashboardPage() {
  const session = await getSession()
  if (!session) redirect("/login")

  const isManager = session.roles.includes("manager")
  const isQC = session.roles.includes("qc")
  const roleLabel = isManager ? "Manager" : isQC ? "QC" : "Designer"
  const firstName = session.name.split(" ")[0] ?? session.name

  return (
    <main className="min-h-full">
      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <PageHeader
          roleLabel={roleLabel}
          title={`Welcome back, ${firstName}`}
          description={
            isManager
              ? "Team overview and active workflows."
              : "Your work today at a glance."
          }
        />
        <Suspense fallback={<DashboardSkeleton cols={isManager ? 4 : 3} />}>
          {isManager ? (
            <ManagerContent />
          ) : isQC ? (
            <QCContent session={session} />
          ) : (
            <DesignerContent session={session} />
          )}
        </Suspense>
      </div>
    </main>
  )
}

// --- Manager ---
async function ManagerContent() {
  const [inProgress, inQC, approvedThisMonth, presentToday] = await Promise.all(
    [
      sql`SELECT COUNT(*) FROM tasks WHERE status = 'in_progress'`,
      sql`SELECT COUNT(*) FROM tasks WHERE status = 'in_qc_review'`,
      sql`SELECT COUNT(*) FROM tasks WHERE status = 'client_ready' AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', now())`,
      sql`SELECT COUNT(DISTINCT user_id) FROM attendance WHERE date = CURRENT_DATE AND logout_at IS NULL`,
    ]
  )

  const stats: Stat[] = [
    {
      label: "In Progress",
      value: (inProgress[0] as { count: string | number }).count,
      note: "Active work",
      icon: Timer,
      accent: "text-blue-500",
    },
    {
      label: "In QC Review",
      value: (inQC[0] as { count: string | number }).count,
      note: "Awaiting review",
      icon: ShieldCheck,
      accent: "text-amber-500",
    },
    {
      label: "Approved This Month",
      value: (approvedThisMonth[0] as { count: string | number }).count,
      note: "Delivered to clients",
      icon: CheckCircle2,
      accent: "text-emerald-500",
    },
    {
      label: "Present Today",
      value: (presentToday[0] as { count: string | number }).count,
      note: "Currently active",
      icon: Users,
      accent: "text-primary",
    },
  ]

  const recentTasks = (await sql`
    SELECT t.id, t.readable_id, t.title, t.customer_project_no, t.cd_project_no, t.speed, t.status, t.priority, t.deadline,
           u.name AS designer_name
    FROM tasks t
    LEFT JOIN users u ON t.assigned_to = u.id
    ORDER BY t.created_at DESC
    LIMIT 8
  `) as Task[]

  return (
    <DashboardContent
      stats={stats}
      tasks={recentTasks}
      sectionLabel="Recent Tasks"
      showDesigner
    />
  )
}

// --- QC ---
async function QCContent({
  session,
}: {
  session: { id: string; name: string }
}) {
  const month = new Date().toISOString().slice(0, 7)
  const [pending, myActive, monthPoints] = await Promise.all([
    sql`SELECT COUNT(*) FROM tasks WHERE status = 'in_qc_review'`,
    sql`SELECT COUNT(*) FROM tasks WHERE assigned_to = ${session.id} AND status IN ('assigned', 'in_progress')`,
    sql`SELECT COALESCE(SUM(points),0) AS total FROM points_log WHERE user_id = ${session.id} AND month = ${month}`,
  ])

  const stats: Stat[] = [
    {
      label: "Pending Review",
      value: (pending[0] as { count: string | number }).count,
      note: "In QC queue",
      icon: Eye,
      accent: "text-amber-500",
    },
    {
      label: "My Active Tasks",
      value: (myActive[0] as { count: string | number }).count,
      note: "Assigned to you",
      icon: ListTodo,
      accent: "text-blue-500",
    },
    {
      label: "Points This Month",
      value: (monthPoints[0] as { total: string | number }).total,
      note: "Earned this cycle",
      icon: Zap,
      accent: "text-primary",
    },
  ]

  const myTasks = (await sql`
    SELECT id, readable_id, title, customer_project_no, cd_project_no, speed, status, priority, deadline
    FROM tasks
    WHERE assigned_to = ${session.id} AND status IN ('assigned', 'in_progress', 'revision_requested')
    ORDER BY
      CASE status WHEN 'assigned' THEN 0 WHEN 'revision_requested' THEN 1 ELSE 2 END,
      deadline ASC NULLS LAST
    LIMIT 6
  `) as Task[]

  return (
    <DashboardContent
      stats={stats}
      tasks={myTasks}
      sectionLabel="My Active Work"
    />
  )
}

// --- Designer ---
async function DesignerContent({
  session,
}: {
  session: { id: string; name: string }
}) {
  const month = new Date().toISOString().slice(0, 7)
  const [myActive, myInQC, monthPoints] = await Promise.all([
    sql`SELECT COUNT(*) FROM tasks WHERE assigned_to = ${session.id} AND status IN ('assigned', 'in_progress')`,
    sql`SELECT COUNT(*) FROM tasks WHERE assigned_to = ${session.id} AND status = 'in_qc_review'`,
    sql`SELECT COALESCE(SUM(points),0) AS total FROM points_log WHERE user_id = ${session.id} AND month = ${month}`,
  ])

  const stats: Stat[] = [
    {
      label: "Active Tasks",
      value: (myActive[0] as { count: string | number }).count,
      note: "Assigned to you",
      icon: ListTodo,
      accent: "text-blue-500",
    },
    {
      label: "In QC",
      value: (myInQC[0] as { count: string | number }).count,
      note: "Awaiting review",
      icon: ShieldCheck,
      accent: "text-amber-500",
    },
    {
      label: "Points This Month",
      value: (monthPoints[0] as { total: string | number }).total,
      note: "Earned this cycle",
      icon: Zap,
      accent: "text-primary",
    },
  ]

  const myTasks = (await sql`
    SELECT id, readable_id, title, customer_project_no, cd_project_no, speed, status, priority, deadline
    FROM tasks
    WHERE assigned_to = ${session.id} AND status IN ('assigned', 'in_progress', 'revision_requested')
    ORDER BY
      CASE status WHEN 'assigned' THEN 0 WHEN 'revision_requested' THEN 1 ELSE 2 END,
      deadline ASC NULLS LAST
    LIMIT 6
  `) as Task[]

  return (
    <DashboardContent
      stats={stats}
      tasks={myTasks}
      sectionLabel="Active Work"
    />
  )
}

// --- Shared content layout ---

const STATUS_DOT: Record<string, string> = {
  assigned: "bg-slate-400",
  in_progress: "bg-blue-500",
  in_qc_review: "bg-amber-500",
  revision_requested: "bg-red-500",
  client_ready: "bg-emerald-500",
  closed: "bg-slate-300",
}

function formatDeadline(deadline: string | null): string {
  if (!deadline) return "—"
  return new Date(deadline).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  })
}

function DashboardContent({
  stats,
  tasks,
  sectionLabel,
  showDesigner,
}: {
  stats: Stat[]
  tasks: Task[]
  sectionLabel: string
  showDesigner?: boolean
}) {
  return (
    <div className="mt-8 space-y-8">
      {/* Stats strip */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <StatCard key={s.label} {...s} />
        ))}
      </div>

      {/* Recent tasks section */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-foreground">
              {sectionLabel}
            </h2>
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-muted px-1.5 text-xs font-medium text-muted-foreground">
              {tasks.length}
            </span>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/tasks">
              View all
              <ArrowRight className="ml-1 h-3 w-3" />
            </Link>
          </Button>
        </div>

        {tasks.length === 0 ? (
          <EmptyState description="No active tasks right now." />
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
            {/* Desktop column headers */}
            <div
              className={`hidden items-center gap-4 border-b border-border bg-muted/30 px-4 py-2.5 text-xs font-medium text-muted-foreground lg:grid ${
                showDesigner
                  ? "grid-cols-[16px_minmax(0,1fr)_140px_100px_80px_80px]"
                  : "grid-cols-[16px_minmax(0,1fr)_100px_80px_80px]"
              }`}
            >
              <span />
              <span>Task</span>
              {showDesigner && <span>Designer</span>}
              <span>Speed</span>
              <span>Status</span>
              <span className="text-right">Deadline</span>
            </div>

            <div className="divide-y divide-border">
              {tasks.map((task) => (
                <Link
                  key={task.id}
                  href={`/tasks/${task.id}`}
                  className={`group flex items-start gap-3 px-4 py-3.5 transition-colors hover:bg-muted/40 lg:grid lg:items-center lg:gap-4 ${
                    showDesigner
                      ? "lg:grid-cols-[16px_minmax(0,1fr)_140px_100px_80px_80px]"
                      : "lg:grid-cols-[16px_minmax(0,1fr)_100px_80px_80px]"
                  }`}
                >
                  {/* Status dot */}
                  <div className="mt-1 flex shrink-0 items-center lg:mt-0">
                    <div
                      className={`h-2 w-2 rounded-full ${STATUS_DOT[task.status] ?? "bg-slate-300"}`}
                      title={STATUS_LABELS[task.status]}
                    />
                  </div>

                  {/* Title + meta */}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground group-hover:text-primary">
                      {task.customer_project_no || task.title}
                    </p>
                    <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span className="font-mono">{task.cd_project_no || task.readable_id}</span>
                      {task.deadline && (
                        <>
                          <span>·</span>
                          <Clock className="h-3 w-3" />
                          <span>{formatDeadline(task.deadline)}</span>
                        </>
                      )}
                      {/* Mobile-only badges */}
                      <span className="ml-auto flex items-center gap-1.5 lg:hidden">
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${SPEED_COLORS[task.speed || "N"] || PRIORITY_COLORS[task.priority] || ""}`}
                        >
                          Speed: {task.speed || (task.priority === "high" ? "U" : "N")}
                        </Badge>
                      </span>
                    </div>
                  </div>

                  {/* Desktop: designer */}
                  {showDesigner && (
                    <span className="hidden truncate text-sm text-muted-foreground lg:block">
                      {task.designer_name ?? "—"}
                    </span>
                  )}

                  {/* Speed badge */}
                  <div className="hidden lg:block">
                    <Badge
                      variant="outline"
                      className={`text-xs ${SPEED_COLORS[task.speed || "N"] || PRIORITY_COLORS[task.priority] || ""}`}
                    >
                      Speed: {task.speed || (task.priority === "high" ? "U" : "N")}
                    </Badge>
                  </div>

                  {/* Status badge */}
                  <div className="hidden lg:block">
                    <Badge
                      variant="outline"
                      className={`text-xs ${STATUS_COLORS[task.status] ?? ""}`}
                    >
                      {STATUS_LABELS[task.status] ?? task.status}
                    </Badge>
                  </div>

                  {/* Deadline */}
                  <span className="hidden text-right text-xs text-muted-foreground tabular-nums lg:block">
                    {formatDeadline(task.deadline)}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  )
}

// --- Skeleton ---
function DashboardSkeleton({ cols }: { cols: number }) {
  return (
    <div className="mt-8 space-y-8">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {Array.from({ length: cols }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-4">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="mt-3 h-8 w-12" />
            <Skeleton className="mt-1.5 h-3 w-16" />
          </div>
        ))}
      </div>
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-5 w-6 rounded-full" />
        </div>
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    </div>
  )
}
