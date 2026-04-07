import Link from "next/link"
import { getSession } from "@/lib/session"
import { redirect } from "next/navigation"
import { sql } from "@/lib/db"
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
  created_at: string
  is_mine: boolean
}

/** Computes auto-priority for unassigned tasks based on hours since creation */
function autoPriority(createdAt: string): "low" | "medium" | "high" {
  const hours =
    (Date.now() - new Date(createdAt).getTime()) / 3_600_000
  if (hours < 8) return "low"
  if (hours < 16) return "medium"
  return "high"
}

/** Returns elapsed time since createdAt as "hh:mm" */
function formatAge(createdAt: string): string {
  const totalMinutes = Math.floor(
    (Date.now() - new Date(createdAt).getTime()) / 60_000,
  )
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
}

function TaskTable({
  tasks,
  showDesigner,
  useAutoPriority,
}: {
  tasks: Task[]
  showDesigner: boolean
  useAutoPriority: boolean
}) {
  return (
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
            {showDesigner && (
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
              Age
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
          {tasks.map((task) => {
            const priority = useAutoPriority
              ? autoPriority(task.created_at)
              : task.priority
            return (
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
                {showDesigner && (
                  <td className="px-4 py-3 text-muted-foreground">
                    {task.designer_name ?? "—"}
                  </td>
                )}
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${PRIORITY_COLORS[priority] ?? ""}`}
                  >
                    {priority}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[task.status] ?? ""}`}
                  >
                    {STATUS_LABELS[task.status] ?? task.status}
                  </span>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                  {formatAge(task.created_at)}
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
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default async function TasksPage() {
  const session = await getSession()
  if (!session) redirect("/login")

  const isManager = session.roles.includes("manager")
  const isQC = session.roles.includes("qc")
  const canManage = isManager || isQC

  // 1. Unified Query: Fetch tasks based on role access
  const allTasks = (await sql`
    SELECT t.id, t.readable_id, t.title, t.client_name, t.status,
           t.priority, t.deadline, t.points, t.created_at,
           u.name AS designer_name,
           (t.assigned_to = ${session.id}) AS is_mine,
           (t.assigned_to IS NULL) AS is_unassigned
    FROM tasks t
    LEFT JOIN users u ON t.assigned_to = u.id
    WHERE
      -- Managers & QC see everything. Designers see only Unassigned + Mine.
      (${canManage}::boolean = true)
      OR (t.status = 'assigned' AND t.assigned_to IS NULL)
      OR (t.assigned_to = ${session.id} AND t.status IN ('assigned', 'in_progress', 'in_qc_review', 'revision_requested'))
    ORDER BY
      CASE t.status
        WHEN 'revision_requested' THEN 0
        WHEN 'assigned'           THEN 1
        WHEN 'in_progress'        THEN 2
        WHEN 'in_qc_review'       THEN 3
        ELSE 4
      END,
      CASE t.priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
      t.deadline ASC NULLS LAST
  `) as (Task & { is_unassigned: boolean })[]

  // 2. Segregate the data
  const myTasks = allTasks.filter((t) => t.is_mine)
  const unassignedTasks = allTasks.filter((t) => t.is_unassigned)

  // "Team Tasks" are tasks assigned to someone else. 
  // We only show this bucket to Managers and QC.
  const teamTasks = allTasks.filter((t) => !t.is_mine && !t.is_unassigned)

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-heading text-xl font-semibold">Tasks</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your active tasks and team workflow.
          </p>
        </div>
        {canManage && (
          <Button asChild>
            <Link href="/tasks/new">
              <PlusSquare className="mr-2 h-4 w-4" />
              Create Task
            </Link>
          </Button>
        )}
      </div>

      {/* My Tasks (Visible to everyone) */}
      <section className="mb-8">
        <div className="mb-3 flex items-center gap-2">
          <h2 className="font-heading text-base font-semibold">My Tasks</h2>
          <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
            {myTasks.length}
          </span>
        </div>
        {myTasks.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card py-10 text-center">
            <p className="text-sm text-muted-foreground">
              You have no active tasks right now.
            </p>
          </div>
        ) : (
          <TaskTable tasks={myTasks} showDesigner={false} useAutoPriority={false} />
        )}
      </section>

      {/* Unassigned Tasks (Visible to everyone) */}
      <section className="mb-8">
        <div className="mb-3 flex items-center gap-2">
          <h2 className="font-heading text-base font-semibold">
            Unassigned Tasks
          </h2>
          <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
            {unassignedTasks.length}
          </span>
        </div>
        <p className="mb-3 text-xs text-muted-foreground">
          Priority auto-escalates every 8 hours — claim high-priority tasks first.
        </p>
        {unassignedTasks.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card py-10 text-center">
            <p className="text-sm text-muted-foreground">
              No open tasks available right now.
            </p>
          </div>
        ) : (
          <TaskTable
            tasks={unassignedTasks}
            showDesigner={false}
            useAutoPriority={true}
          />
        )}
      </section>

      {/* Team Tasks (Visible ONLY to Managers and QC) */}
      {canManage && (
        <section>
          <div className="mb-3 flex items-center gap-2">
            <h2 className="font-heading text-base font-semibold">
              Team Tasks
            </h2>
            <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
              {teamTasks.length}
            </span>
          </div>
          <p className="mb-3 text-xs text-muted-foreground">
            Tasks currently being worked on by other team members.
          </p>
          {teamTasks.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card py-10 text-center">
              <p className="text-sm text-muted-foreground">
                No active team tasks right now.
              </p>
            </div>
          ) : (
            // We pass showDesigner={true} here so Managers/QC can see who is working on it
            <TaskTable tasks={teamTasks} showDesigner={true} useAutoPriority={false} />
          )}
        </section>
      )}
    </div>
  )
}