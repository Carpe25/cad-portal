import Link from "next/link"
import { getSession } from "@/lib/session"
import { redirect } from "next/navigation"
import { sql } from "@/lib/db"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { InboxIcon, PlusSquare } from "lucide-react"
import { STATUS_LABELS, STATUS_COLORS, PRIORITY_COLORS } from "@/lib/task-utils"

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
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <Table>
        <TableHeader className="bg-muted/40">
          <TableRow>
            <TableHead>ID</TableHead>
            <TableHead>Title</TableHead>
            <TableHead>Client</TableHead>
            {showDesigner && <TableHead>Designer</TableHead>}
            <TableHead>Priority</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Age</TableHead>
            <TableHead>Points</TableHead>
            <TableHead>Deadline</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tasks.map((task) => {
            const priority = useAutoPriority
              ? autoPriority(task.created_at)
              : task.priority
            return (
              <TableRow
                key={task.id}
                className="hover:bg-muted/30"
              >
                <TableCell className="font-mono text-xs text-muted-foreground">
                  <Link
                    href={`/tasks/${task.id}`}
                    className="hover:text-foreground hover:underline"
                  >
                    {task.readable_id}
                  </Link>
                </TableCell>
                <TableCell>
                  <Link
                    href={`/tasks/${task.id}`}
                    className="font-medium hover:underline"
                  >
                    {task.title}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {task.client_name}
                </TableCell>
                {showDesigner && (
                  <TableCell className="text-muted-foreground">
                    {task.designer_name ?? "—"}
                  </TableCell>
                )}
                <TableCell>
                  <Badge
                    variant="outline"
                    className={`border-transparent capitalize ${PRIORITY_COLORS[priority] ?? ""}`}
                  >
                    {priority}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={`border-transparent ${STATUS_COLORS[task.status] ?? ""}`}
                  >
                    {STATUS_LABELS[task.status] ?? task.status}
                  </Badge>
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {formatAge(task.created_at)}
                </TableCell>
                <TableCell className="font-medium">{task.points}</TableCell>
                <TableCell className="text-muted-foreground">
                  {task.deadline
                    ? new Date(task.deadline).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                    })
                    : "—"}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
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
          <EmptyState message="You have no active tasks right now." />
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
          <EmptyState message="No open tasks available right now." />
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
            <EmptyState message="No active team tasks right now." />
          ) : (
            // We pass showDesigner={true} here so Managers/QC can see who is working on it
            <TaskTable tasks={teamTasks} showDesigner={true} useAutoPriority={false} />
          )}
        </section>
      )}
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border/60 bg-card py-12 text-center animate-in fade-in duration-500">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted/50">
        <InboxIcon className="h-5 w-5 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium text-muted-foreground">{message}</p>
    </div>
  )
}