import { getSession } from "@/lib/session"
import { redirect } from "next/navigation"
import { sql } from "@/lib/db"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

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
  const [inProgress, inQC, approvedThisMonth, presentToday] =
    await Promise.all([
      sql`SELECT COUNT(*) FROM tasks WHERE status = 'in_progress'`,
      sql`SELECT COUNT(*) FROM tasks WHERE status = 'in_qc_review'`,
      sql`SELECT COUNT(*) FROM tasks WHERE status = 'client_ready' AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', now())`,
      sql`SELECT COUNT(DISTINCT user_id) FROM attendance WHERE date = CURRENT_DATE AND logout_at IS NULL`,
    ])

  const stats = [
    { label: "In Progress", value: (inProgress[0] as { count: string | number }).count },
    { label: "In QC Review", value: (inQC[0] as { count: string | number }).count },
    { label: "Approved This Month", value: (approvedThisMonth[0] as { count: string | number }).count },
    { label: "Present Today", value: (presentToday[0] as { count: string | number }).count },
  ]

  const recentTasks = await sql`
    SELECT t.id, t.readable_id, t.title, t.status, t.priority, t.deadline,
           u.name AS designer_name
    FROM tasks t
    LEFT JOIN users u ON t.assigned_to = u.id
    ORDER BY t.created_at DESC
    LIMIT 8
  `

  return (
    <div className="p-6">
      <h1 className="font-heading text-xl font-semibold">
        Welcome back, {session.name.split(" ")[0]}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Here&apos;s the team overview.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardHeader className="pb-1 pt-4">
              <CardTitle className="text-xs font-normal text-muted-foreground">
                {s.label}
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-4">
              <p className="font-heading text-3xl font-semibold">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-8">
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Recent Tasks
        </h2>
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          {(recentTasks as Task[]).length === 0 ? (
            <EmptyState message="No tasks yet. Create your first task." />
          ) : (
            <TaskTable tasks={recentTasks as Task[]} />
          )}
        </div>
      </div>
    </div>
  )
}

async function QCDashboard({ session }: { session: { id: string; name: string } }) {
  const month = new Date().toISOString().slice(0, 7)
  const [pending, myActive, monthPoints] = await Promise.all([
    sql`SELECT COUNT(*) FROM tasks WHERE status = 'in_qc_review'`,
    sql`SELECT COUNT(*) FROM tasks WHERE assigned_to = ${session.id} AND status IN ('assigned', 'in_progress')`,
    sql`SELECT COALESCE(SUM(points),0) AS total FROM points_log WHERE user_id = ${session.id} AND month = ${month}`,
  ])

  const stats = [
    { label: "Pending Review", value: (pending[0] as { count: string | number }).count },
    { label: "My Active Tasks", value: (myActive[0] as { count: string | number }).count },
    { label: "Points This Month", value: (monthPoints[0] as { total: string | number }).total },
  ]

  const myTasks = await sql`
    SELECT id, readable_id, title, status, priority, deadline
    FROM tasks
    WHERE assigned_to = ${session.id} AND status IN ('assigned', 'in_progress', 'revision_requested')
    ORDER BY
      CASE status WHEN 'assigned' THEN 0 WHEN 'revision_requested' THEN 1 ELSE 2 END,
      deadline ASC NULLS LAST
    LIMIT 6
  `

  return (
    <div className="p-6">
      <h1 className="font-heading text-xl font-semibold">
        Hey {session.name.split(" ")[0]}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Here&apos;s your work today.
      </p>
      <div className="mt-6 grid grid-cols-3 gap-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardHeader className="pb-1 pt-4">
              <CardTitle className="text-xs font-normal text-muted-foreground">
                {s.label}
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-4">
              <p className="font-heading text-3xl font-semibold">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="mt-8">
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">
          My Active Work
        </h2>
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          {(myTasks as Task[]).length === 0 ? (
            <EmptyState message="No active tasks. Pick one from All Tasks." />
          ) : (
            <TaskTable tasks={myTasks as Task[]} />
          )}
        </div>
      </div>
    </div>
  )
}

async function DesignerDashboard({ session }: { session: { id: string; name: string } }) {
  const month = new Date().toISOString().slice(0, 7)
  const [myActive, myInQC, monthPoints] = await Promise.all([
    sql`SELECT COUNT(*) FROM tasks WHERE assigned_to = ${session.id} AND status IN ('assigned', 'in_progress')`,
    sql`SELECT COUNT(*) FROM tasks WHERE assigned_to = ${session.id} AND status = 'in_qc_review'`,
    sql`SELECT COALESCE(SUM(points),0) AS total FROM points_log WHERE user_id = ${session.id} AND month = ${month}`,
  ])

  const stats = [
    { label: "Active Tasks", value: (myActive[0] as { count: string | number }).count },
    { label: "In QC", value: (myInQC[0] as { count: string | number }).count },
    { label: "Points This Month", value: (monthPoints[0] as { total: string | number }).total },
  ]

  const myTasks = await sql`
    SELECT id, readable_id, title, status, priority, deadline
    FROM tasks
    WHERE assigned_to = ${session.id} AND status IN ('assigned', 'in_progress', 'revision_requested')
    ORDER BY
      CASE status WHEN 'assigned' THEN 0 WHEN 'revision_requested' THEN 1 ELSE 2 END,
      deadline ASC NULLS LAST
    LIMIT 6
  `

  return (
    <div className="p-6">
      <h1 className="font-heading text-xl font-semibold">
        Hey {session.name.split(" ")[0]}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Here&apos;s your work today.
      </p>

      <div className="mt-6 grid grid-cols-3 gap-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardHeader className="pb-1 pt-4">
              <CardTitle className="text-xs font-normal text-muted-foreground">
                {s.label}
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-4">
              <p className="font-heading text-3xl font-semibold">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-8">
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Active Work
        </h2>
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          {(myTasks as Task[]).length === 0 ? (
            <EmptyState message="No active tasks. Check My Tasks for new assignments." />
          ) : (
            <TaskTable tasks={myTasks as Task[]} />
          )}
        </div>
      </div>
    </div>
  )
}

type Task = {
  id: string
  readable_id: string
  title: string
  status: string
  priority: string
  deadline: string | null
  designer_name?: string
}

const STATUS_LABELS: Record<string, string> = {
  assigned: "Assigned",
  in_progress: "In Progress",
  in_qc_review: "In QC Review",
  revision_requested: "Revision",
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

function TaskTable({ tasks }: { tasks: Task[] }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-border bg-muted/40">
          <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">
            ID
          </th>
          <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">
            Title
          </th>
          <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">
            Priority
          </th>
          <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">
            Status
          </th>
          <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">
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
              {task.readable_id}
            </td>
            <td className="px-4 py-3 font-medium">{task.title}</td>
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
            <td className="px-4 py-3 text-muted-foreground">
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
    <div className="flex flex-col items-center gap-2 py-10 text-center">
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  )
}
