import Link from "next/link"
import { Suspense } from "react"
import { redirect } from "next/navigation"
import {
  ArrowRight,
  CircleAlert,
  Clock,
  ClipboardList,
  InboxIcon,
  Layers3,
  PlusSquare,
  ShieldCheck,
  Sparkles,
  Users,
  type LucideIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { sql } from "@/lib/db"
import { getSession, type SessionUser } from "@/lib/session"
import { PRIORITY_COLORS, STATUS_COLORS, STATUS_LABELS } from "@/lib/task-utils"

// --- Types ---
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
  is_unassigned: boolean
}

type Metric = {
  label: string
  value: number
  note: string
  icon: LucideIcon
  accent: string
}

// Status dot colors for the row indicator
const STATUS_DOT: Record<string, string> = {
  assigned: "bg-slate-400",
  in_progress: "bg-blue-500",
  in_qc_review: "bg-amber-500",
  revision_requested: "bg-red-500",
  client_ready: "bg-emerald-500",
  closed: "bg-slate-300",
}

// --- Utilities ---
function autoPriority(createdAt: string): "low" | "medium" | "high" {
  const hours = (Date.now() - new Date(createdAt).getTime()) / 3_600_000
  if (hours < 8) return "low"
  if (hours < 16) return "medium"
  return "high"
}

function formatAge(createdAt: string): string {
  const minutes = Math.floor(
    (Date.now() - new Date(createdAt).getTime()) / 60_000
  )
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

function formatDeadline(deadline: string | null): string {
  if (!deadline) return "—"
  return new Date(deadline).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  })
}

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
    SELECT t.id, t.readable_id, t.title, t.client_name, t.status,
           t.priority, t.deadline, t.points, t.created_at,
           u.name AS designer_name,
           (t.assigned_to = ${session.id}) AS is_mine,
           (t.assigned_to IS NULL) AS is_unassigned
    FROM tasks t
    LEFT JOIN users u ON t.assigned_to = u.id
    WHERE
      t.status IN ('assigned', 'in_progress', 'in_qc_review', 'revision_requested')
      AND (
        (${canManage}::boolean = true)
        OR (t.assigned_to IS NULL)
        OR (t.assigned_to = ${session.id})
      )
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
  `) as Task[]

  const myTasks = allTasks.filter((t) => t.is_mine)
  const unassignedTasks = allTasks.filter((t) => t.is_unassigned)
  const teamTasks = allTasks.filter((t) => !t.is_mine && !t.is_unassigned)

  const highPriorityQueueCount = unassignedTasks.filter(
    (t) => autoPriority(t.created_at) === "high"
  ).length
  const needsAttention = allTasks.filter(
    (t) =>
      t.status === "revision_requested" ||
      (t.is_unassigned && autoPriority(t.created_at) === "high")
  ).length

  const metrics: Metric[] = [
    {
      label: "My Tasks",
      value: myTasks.length,
      note: "Assigned to you",
      icon: ClipboardList,
      accent: "text-primary",
    },
    {
      label: "Open Queue",
      value: unassignedTasks.length,
      note: "Ready to claim",
      icon: InboxIcon,
      accent: "text-blue-500",
    },
    {
      label: "Needs Attention",
      value: needsAttention,
      note: "Revisions & urgent",
      icon: CircleAlert,
      accent: "text-amber-500",
    },
    canManage
      ? {
          label: "Team Active",
          value: teamTasks.length,
          note: "Team workflows",
          icon: Users,
          accent: "text-emerald-500",
        }
      : {
          label: "In QC",
          value: allTasks.filter((t) => t.status === "in_qc_review").length,
          note: "Awaiting review",
          icon: ShieldCheck,
          accent: "text-emerald-500",
        },
  ]

  const recommendedTask =
    myTasks[0] ??
    unassignedTasks.find((t) => autoPriority(t.created_at) === "high") ??
    unassignedTasks[0] ??
    (canManage ? teamTasks[0] : null)

  const sections = [
    {
      id: "my-tasks",
      title: "My Tasks",
      desc: "Your active assignments, ordered by urgency.",
      tasks: myTasks,
      showDesigner: false,
      useAutoPriority: false,
    },
    {
      id: "open-queue",
      title: "Open Queue",
      desc: "Unassigned work. Priority escalates every 8 hours.",
      tasks: unassignedTasks,
      showDesigner: false,
      useAutoPriority: true,
    },
    ...(canManage
      ? [
          {
            id: "team-tasks",
            title: "Team Tasks",
            desc: "Live visibility into active team workflows.",
            tasks: teamTasks,
            showDesigner: true,
            useAutoPriority: false,
          },
        ]
      : []),
  ]

  return (
    <div className="mt-8 space-y-8">
      {/* Stats strip */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {metrics.map((m) => (
          <StatCard key={m.label} metric={m} />
        ))}
      </div>

      {/* Urgent signal banner — only show when there are escalated items */}
      {highPriorityQueueCount > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900/50 dark:bg-amber-950/30">
          <Sparkles className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <p className="text-sm text-amber-800 dark:text-amber-300">
            <span className="font-semibold">
              {highPriorityQueueCount} queue item
              {highPriorityQueueCount !== 1 ? "s" : ""}
            </span>{" "}
            auto-escalated to high priority — pick up soon.
          </p>
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="ml-auto shrink-0 text-amber-700 hover:bg-amber-100 hover:text-amber-900 dark:text-amber-400"
          >
            <a href="#open-queue">View queue</a>
          </Button>
        </div>
      )}

      {/* Main layout */}
      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_300px]">
        {/* Task sections */}
        <div className="space-y-10">
          {sections.map((sec) => (
            <TaskSection key={sec.id} {...sec} />
          ))}
        </div>

        {/* Sidebar */}
        <aside className="space-y-4">
          {recommendedTask && <FocusCard task={recommendedTask} />}
          <WorkflowCard tasks={allTasks} />
        </aside>
      </div>
    </div>
  )
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

// --- Stat Card ---
function StatCard({ metric }: { metric: Metric }) {
  return (
    <div className="group relative rounded-xl border border-border bg-card p-4 shadow-xs transition-shadow hover:shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">
          {metric.label}
        </p>
        <metric.icon className={`h-3.5 w-3.5 shrink-0 ${metric.accent}`} />
      </div>
      <p className="mt-2.5 text-3xl font-bold tracking-tight text-foreground">
        {metric.value}
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">{metric.note}</p>
    </div>
  )
}

// --- Task Section ---
function TaskSection({
  id,
  title,
  desc,
  tasks,
  showDesigner,
  useAutoPriority,
}: {
  id: string
  title: string
  desc: string
  tasks: Task[]
  showDesigner: boolean
  useAutoPriority: boolean
}) {
  return (
    <section id={id} className="scroll-mt-20 space-y-3">
      {/* Section header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-foreground">{title}</h2>
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-muted px-1.5 text-xs font-medium text-muted-foreground">
              {tasks.length}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">{desc}</p>
        </div>
      </div>

      {/* Empty state */}
      {tasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 bg-muted/20 py-14 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
            <InboxIcon className="h-5 w-5 text-muted-foreground" />
          </div>
          <p className="mt-3 text-sm font-medium text-foreground">All clear</p>
          <p className="mt-1 text-xs text-muted-foreground">
            This queue has no active tasks right now.
          </p>
        </div>
      ) : (
        /* Task list */
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
          {/* Desktop column headers */}
          <div className="hidden grid-cols-[16px_minmax(0,1fr)_140px_100px_80px_80px] items-center gap-4 border-b border-border bg-muted/30 px-4 py-2.5 text-xs font-medium text-muted-foreground lg:grid">
            <span />
            <span>Task</span>
            {showDesigner ? <span>Designer</span> : <span>Client</span>}
            <span>Priority</span>
            <span>Status</span>
            <span className="text-right">Age</span>
          </div>

          <div className="divide-y divide-border">
            {tasks.map((task, idx) => {
              const priority = useAutoPriority
                ? autoPriority(task.created_at)
                : task.priority
              const isLast = idx === tasks.length - 1
              return (
                <TaskRow
                  key={task.id}
                  task={task}
                  priority={priority}
                  showDesigner={showDesigner}
                  isLast={isLast}
                />
              )
            })}
          </div>
        </div>
      )}
    </section>
  )
}

// --- Task Row ---
function TaskRow({
  task,
  priority,
  showDesigner,
}: {
  task: Task
  priority: string
  showDesigner: boolean
  isLast: boolean
}) {
  return (
    <Link
      href={`/tasks/${task.id}`}
      className="group flex items-start gap-3 px-4 py-3.5 transition-colors hover:bg-muted/40 lg:grid lg:grid-cols-[16px_minmax(0,1fr)_140px_100px_80px_80px] lg:items-center lg:gap-4"
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
          {task.title}
        </p>
        <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="font-mono">{task.readable_id}</span>
          <span>·</span>
          <span className="truncate">
            {showDesigner
              ? (task.designer_name ?? "Unassigned")
              : task.client_name}
          </span>
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
              className={`text-[10px] ${PRIORITY_COLORS[priority]}`}
            >
              {priority}
            </Badge>
            <span className="text-[10px] text-muted-foreground">
              {formatAge(task.created_at)}
            </span>
          </span>
        </div>
      </div>

      {/* Desktop: designer or client label (second column) */}
      <span className="hidden truncate text-sm text-muted-foreground lg:block">
        {showDesigner ? (task.designer_name ?? "—") : task.client_name}
      </span>

      {/* Priority badge */}
      <div className="hidden lg:block">
        <Badge
          variant="outline"
          className={`text-xs ${PRIORITY_COLORS[priority]}`}
        >
          {priority}
        </Badge>
      </div>

      {/* Status badge */}
      <div className="hidden lg:block">
        <Badge
          variant="outline"
          className={`text-xs ${STATUS_COLORS[task.status]}`}
        >
          {STATUS_LABELS[task.status]}
        </Badge>
      </div>

      {/* Age */}
      <span className="hidden text-right text-xs text-muted-foreground tabular-nums lg:block">
        {formatAge(task.created_at)}
      </span>
    </Link>
  )
}

// --- Focus Card ---
function FocusCard({ task }: { task: Task }) {
  return (
    <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
      <div className="flex items-center gap-2">
        <Sparkles className="h-3.5 w-3.5 text-primary" />
        <p className="text-xs font-semibold tracking-wider text-primary uppercase">
          Recommended next
        </p>
      </div>
      <div className="mt-3 space-y-1">
        <p className="text-sm leading-snug font-medium text-foreground">
          {task.title}
        </p>
        <p className="text-xs text-muted-foreground">
          <span className="font-mono">{task.readable_id}</span> ·{" "}
          {task.client_name}
        </p>
      </div>
      <div className="mt-4 flex items-center gap-2">
        <Badge
          variant="outline"
          className={`text-xs ${STATUS_COLORS[task.status]}`}
        >
          {STATUS_LABELS[task.status]}
        </Badge>
        <Button asChild size="sm" className="ml-auto h-7 px-3 text-xs">
          <Link href={`/tasks/${task.id}`}>
            Open <ArrowRight className="ml-1 h-3 w-3" />
          </Link>
        </Button>
      </div>
    </div>
  )
}

// --- Workflow Card ---
function WorkflowCard({ tasks }: { tasks: Task[] }) {
  const statuses = [
    { key: "revision_requested", dot: "bg-red-500" },
    { key: "in_progress", dot: "bg-blue-500" },
    { key: "in_qc_review", dot: "bg-amber-500" },
    { key: "assigned", dot: "bg-slate-400" },
  ]
  const counts = statuses.map((s) => ({
    ...s,
    count: tasks.filter((t) => t.status === s.key).length,
  }))
  const max = Math.max(...counts.map((c) => c.count), 1)
  const total = counts.reduce((a, c) => a + c.count, 0)

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers3 className="h-3.5 w-3.5 text-muted-foreground" />
          <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            Workflow
          </p>
        </div>
        <span className="text-xs text-muted-foreground">{total} active</span>
      </div>
      <div className="mt-4 space-y-3">
        {counts.map((item) => (
          <div key={item.key} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5">
                <div className={`h-1.5 w-1.5 rounded-full ${item.dot}`} />
                <span className="text-muted-foreground">
                  {STATUS_LABELS[item.key]}
                </span>
              </div>
              <span className="font-medium text-foreground tabular-nums">
                {item.count}
              </span>
            </div>
            <div className="h-1 overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full rounded-full transition-all ${item.dot}`}
                style={{
                  width: `${Math.max((item.count / max) * 100, item.count > 0 ? 8 : 0)}%`,
                }}
              />
            </div>
          </div>
        ))}
      </div>
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
