import Link from "next/link"
import { getSession } from "@/lib/session"
import { redirect } from "next/navigation"
import { sql } from "@/lib/db"
import { Button } from "@/components/ui/button"
import {
  STATUS_LABELS,
  STATUS_COLORS,
  PRIORITY_COLORS,
} from "@/lib/task-utils"
import {
  InboxIcon,
  Timer,
  ShieldCheck,
  CheckCircle2,
  Users,
  ListTodo,
  Eye,
  Zap,
  type LucideIcon,
} from "lucide-react"

type Task = {
  id: string
  readable_id: string
  title: string
  status: string
  priority: string
  deadline: string | null
  designer_name?: string
}

type Stat = {
  label: string
  value: string | number
  icon: LucideIcon
  color: string
}

export default async function DashboardPage() {
  const session = await getSession()
  if (!session) redirect("/login")

  const isManager = session.roles.includes("manager")
  const isQC = session.roles.includes("qc")

  if (isManager) return <ManagerDashboard session={session} />
  if (isQC) return <QCDashboard session={session} />
  return <DesignerDashboard session={session} />
}

async function ManagerDashboard({ session }: { session: { name: string } }) {
  const [inProgress, inQC, approvedThisMonth, presentToday] = await Promise.all(
    [
      sql`SELECT COUNT(*) FROM tasks WHERE status = 'in_progress'`,
      sql`SELECT COUNT(*) FROM tasks WHERE status = 'in_qc_review'`,
      sql`SELECT COUNT(*) FROM tasks WHERE status = 'client_ready' AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', now())`,
      sql`SELECT COUNT(DISTINCT user_id) FROM attendance WHERE date = CURRENT_DATE AND logout_at IS NULL`,
    ],
  )

  const stats: Stat[] = [
    {
      label: "In Progress",
      value: (inProgress[0] as { count: string | number }).count,
      icon: Timer,
      color: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    },
    {
      label: "In QC Review",
      value: (inQC[0] as { count: string | number }).count,
      icon: ShieldCheck,
      color: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    },
    {
      label: "Approved This Month",
      value: (approvedThisMonth[0] as { count: string | number }).count,
      icon: CheckCircle2,
      color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    },
    {
      label: "Present Today",
      value: (presentToday[0] as { count: string | number }).count,
      icon: Users,
      color: "bg-primary/10 text-primary",
    },
  ]

  const recentTasks = (await sql`
    SELECT t.id, t.readable_id, t.title, t.status, t.priority, t.deadline,
           u.name AS designer_name
    FROM tasks t
    LEFT JOIN users u ON t.assigned_to = u.id
    ORDER BY t.created_at DESC
    LIMIT 8
  `) as Task[]

  return (
    <DashboardShell
      greeting={`Welcome back, ${session.name.split(" ")[0]}`}
      subtitle="Here's the team overview."
    >
      <StatsGrid stats={stats} />
      <RecentTasksSection tasks={recentTasks} showDesigner />
    </DashboardShell>
  )
}

async function QCDashboard({
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
      icon: Eye,
      color: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    },
    {
      label: "My Active Tasks",
      value: (myActive[0] as { count: string | number }).count,
      icon: ListTodo,
      color: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    },
    {
      label: "Points This Month",
      value: (monthPoints[0] as { total: string | number }).total,
      icon: Zap,
      color: "bg-primary/10 text-primary",
    },
  ]

  const myTasks = (await sql`
    SELECT id, readable_id, title, status, priority, deadline
    FROM tasks
    WHERE assigned_to = ${session.id} AND status IN ('assigned', 'in_progress', 'revision_requested')
    ORDER BY
      CASE status WHEN 'assigned' THEN 0 WHEN 'revision_requested' THEN 1 ELSE 2 END,
      deadline ASC NULLS LAST
    LIMIT 6
  `) as Task[]

  return (
    <DashboardShell
      greeting={`Hey ${session.name.split(" ")[0]}`}
      subtitle="Here's your work today."
    >
      <StatsGrid stats={stats} />
      <RecentTasksSection tasks={myTasks} label="My Active Work" />
    </DashboardShell>
  )
}

async function DesignerDashboard({
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
      icon: ListTodo,
      color: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    },
    {
      label: "In QC",
      value: (myInQC[0] as { count: string | number }).count,
      icon: ShieldCheck,
      color: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    },
    {
      label: "Points This Month",
      value: (monthPoints[0] as { total: string | number }).total,
      icon: Zap,
      color: "bg-primary/10 text-primary",
    },
  ]

  const myTasks = (await sql`
    SELECT id, readable_id, title, status, priority, deadline
    FROM tasks
    WHERE assigned_to = ${session.id} AND status IN ('assigned', 'in_progress', 'revision_requested')
    ORDER BY
      CASE status WHEN 'assigned' THEN 0 WHEN 'revision_requested' THEN 1 ELSE 2 END,
      deadline ASC NULLS LAST
    LIMIT 6
  `) as Task[]

  return (
    <DashboardShell
      greeting={`Hey ${session.name.split(" ")[0]}`}
      subtitle="Here's your work today."
    >
      <StatsGrid stats={stats} />
      <RecentTasksSection tasks={myTasks} label="Active Work" />
    </DashboardShell>
  )
}

// ── Shared layout ──────────────────────────────────────────────────────────────

function DashboardShell({
  greeting,
  subtitle,
  children,
}: {
  greeting: string
  subtitle: string
  children: React.ReactNode
}) {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="font-heading text-xl font-semibold">{greeting}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
      </div>
      {children}
    </div>
  )
}

function StatsGrid({ stats }: { stats: Stat[] }) {
  return (
    <div
      className={`grid gap-4 ${stats.length === 4 ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-1 sm:grid-cols-3"}`}
    >
      {stats.map((s) => (
        <div
          key={s.label}
          className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5 shadow-xs"
        >
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs font-medium text-muted-foreground">
              {s.label}
            </p>
            <div
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${s.color}`}
            >
              <s.icon className="h-4 w-4" />
            </div>
          </div>
          <p className="font-heading text-3xl font-bold tracking-tight">
            {s.value}
          </p>
        </div>
      ))}
    </div>
  )
}

function RecentTasksSection({
  tasks,
  label = "Recent Tasks",
  showDesigner,
}: {
  tasks: Task[]
  label?: string
  showDesigner?: boolean
}) {
  return (
    <div className="mt-8">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </h2>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/tasks" className="text-xs">
            View all →
          </Link>
        </Button>
      </div>
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
        {tasks.length === 0 ? (
          <EmptyState message="No active tasks right now." />
        ) : (
          <TaskTable tasks={tasks} showDesigner={showDesigner} />
        )}
      </div>
    </div>
  )
}

function TaskTable({
  tasks,
  showDesigner,
}: {
  tasks: Task[]
  showDesigner?: boolean
}) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-border bg-muted/40">
          <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">
            ID
          </th>
          <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">
            Title
          </th>
          {showDesigner && (
            <th className="hidden px-4 py-2.5 text-left text-xs font-medium text-muted-foreground sm:table-cell">
              Designer
            </th>
          )}
          <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">
            Priority
          </th>
          <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">
            Status
          </th>
          <th className="hidden px-4 py-2.5 text-left text-xs font-medium text-muted-foreground sm:table-cell">
            Deadline
          </th>
        </tr>
      </thead>
      <tbody>
        {tasks.map((task) => (
          <tr
            key={task.id}
            className="border-b border-border/60 last:border-0 hover:bg-muted/30"
          >
            <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
              <Link
                href={`/tasks/${task.id}`}
                className="hover:text-foreground hover:underline"
              >
                {task.readable_id}
              </Link>
            </td>
            <td className="px-4 py-3">
              <Link
                href={`/tasks/${task.id}`}
                className="font-medium hover:underline"
              >
                {task.title}
              </Link>
            </td>
            {showDesigner && (
              <td className="hidden px-4 py-3 text-muted-foreground sm:table-cell">
                {task.designer_name ?? "—"}
              </td>
            )}
            <td className="px-4 py-3">
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${PRIORITY_COLORS[task.priority] ?? ""}`}
              >
                {task.priority}
              </span>
            </td>
            <td className="px-4 py-3">
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[task.status] ?? ""}`}
              >
                {STATUS_LABELS[task.status] ?? task.status}
              </span>
            </td>
            <td className="hidden px-4 py-3 text-muted-foreground sm:table-cell">
              {task.deadline
                ? new Date(task.deadline).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })
                : "—"}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-12 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
        <InboxIcon className="h-5 w-5 text-muted-foreground" />
      </div>
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  )
}
