import Link from "next/link"
import { getSession } from "@/lib/session"
import { redirect } from "next/navigation"
import { sql } from "@/lib/db"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { PlusSquare } from "lucide-react"

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

type Task = {
  id: string
  readable_id: string
  title: string
  client_name: string
  status: string
  priority: string
  deadline: string | null
  points: number
  designer_name: string | null
}

export default async function TasksPage() {
  const session = await getSession()
  if (!session) redirect("/login")

  const isManager = session.roles.includes("manager")

  let tasks: Task[]

  if (isManager) {
    // Manager sees all tasks
    const rows = await sql`
      SELECT t.id, t.readable_id, t.title, t.client_name, t.status,
             t.priority, t.deadline, t.points, u.name AS designer_name
      FROM tasks t
      LEFT JOIN users u ON t.assigned_to = u.id
      ORDER BY t.created_at DESC
    `
    tasks = rows as Task[]
  } else {
    // Designer sees tasks assigned to them that are unstarted (assigned status)
    const rows = await sql`
      SELECT t.id, t.readable_id, t.title, t.client_name, t.status,
             t.priority, t.deadline, t.points, NULL AS designer_name
      FROM tasks t
      WHERE t.assigned_to = ${session.id} AND t.status = 'assigned'
      ORDER BY
        CASE t.priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
        t.deadline ASC NULLS LAST
    `
    tasks = rows as Task[]
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-heading text-xl font-semibold">
            {isManager ? "All Tasks" : "Available Tasks"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isManager
              ? "Full task list — click a task to open details."
              : "Tasks assigned to you. Open a task and click Assign to Me to start working."}
          </p>
        </div>
        {isManager && (
          <Button asChild>
            <Link href="/tasks/new">
              <PlusSquare className="mr-2 h-4 w-4" />
              Create Task
            </Link>
          </Button>
        )}
      </div>

      {tasks.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card py-16 text-center">
          <p className="text-sm text-muted-foreground">
            {isManager ? "No tasks yet." : "No tasks assigned to you yet."}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  ID
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Title
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Client
                </th>
                {isManager && (
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    Designer
                  </th>
                )}
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Priority
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Status
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Points
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
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
                  <td className="px-4 py-3 text-muted-foreground">
                    {task.client_name}
                  </td>
                  {isManager && (
                    <td className="px-4 py-3 text-muted-foreground">
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
                  <td className="px-4 py-3 font-medium">{task.points}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {task.deadline
                      ? new Date(task.deadline).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                        })
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
