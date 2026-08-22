"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import {
  Search,
  X,
  CircleAlert,
  ClipboardList,
  InboxIcon,
  Layers3,
  ShieldCheck,
  Sparkles,
  Users,
  type LucideIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DeadlineCountdown } from "@/components/portal/deadline-countdown"
import {
  PRIORITY_COLORS,
  SPEED_COLORS,
  STATUS_COLORS,
  STATUS_LABELS,
  formatDateDisplay,
} from "@/lib/task-utils"

export type Task = {
  id: string
  readable_id: string
  title: string
  customer_project_no: string | null
  cd_project_no: string | null
  speed: string | null
  client_name: string
  customer_code: string | null
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

const STATUS_DOT: Record<string, string> = {
  assigned: "bg-slate-400",
  in_progress: "bg-blue-500",
  in_qc_review: "bg-amber-500",
  revision_requested: "bg-red-500",
  ready_for_client: "bg-teal-500",
  client_ready: "bg-emerald-500",
  closed: "bg-slate-300",
}

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

export function TasksSearchWorkspace({
  allTasks,
  canManage,
}: {
  allTasks: Task[]
  canManage: boolean
}) {
  const [searchQuery, setSearchQuery] = useState("")

  const trimmedQuery = searchQuery.trim().toLowerCase()

  // Filter tasks based on search query across all fields (CD Project No, Customer Project No, Title, Client Name, etc.)
  const filteredTasks = useMemo(() => {
    if (!trimmedQuery) return allTasks

    return allTasks.filter((t) => {
      const cdNo = (t.cd_project_no || "").toLowerCase()
      const custProjNo = (t.customer_project_no || "").toLowerCase()
      const readId = (t.readable_id || "").toLowerCase()
      const title = (t.title || "").toLowerCase()
      const client = (t.client_name || "").toLowerCase()
      const custCode = (t.customer_code || "").toLowerCase()
      const designer = (t.designer_name || "").toLowerCase()

      return (
        cdNo.includes(trimmedQuery) ||
        custProjNo.includes(trimmedQuery) ||
        readId.includes(trimmedQuery) ||
        title.includes(trimmedQuery) ||
        client.includes(trimmedQuery) ||
        custCode.includes(trimmedQuery) ||
        designer.includes(trimmedQuery)
      )
    })
  }, [allTasks, trimmedQuery])

  // Active workflow tasks (excluding closed/client_ready unless searching)
  const activeTasks = useMemo(() => {
    return allTasks.filter(
      (t) => t.status !== "closed" && t.status !== "client_ready"
    )
  }, [allTasks])

  const myTasks = useMemo(
    () => activeTasks.filter((t) => t.is_mine),
    [activeTasks]
  )
  const unassignedTasks = useMemo(
    () => activeTasks.filter((t) => t.is_unassigned),
    [activeTasks]
  )
  const teamTasks = useMemo(
    () => activeTasks.filter((t) => !t.is_mine && !t.is_unassigned),
    [activeTasks]
  )

  const highPriorityQueueCount = useMemo(
    () =>
      unassignedTasks.filter(
        (t) => autoPriority(t.created_at) === "high"
      ).length,
    [unassignedTasks]
  )

  const needsAttention = useMemo(
    () =>
      activeTasks.filter(
        (t) =>
          t.status === "revision_requested" ||
          (t.is_unassigned && autoPriority(t.created_at) === "high")
      ).length,
    [activeTasks]
  )

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
          value: activeTasks.filter((t) => t.status === "in_qc_review").length,
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
    <div className="mt-6 space-y-6">
      {/* Search Bar */}
      <div className="relative flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 rounded-2xl border border-border bg-card p-3 shadow-xs">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search by Project No (e.g. CD...), Customer Project No, Client, or Title..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-10 border-2 border-black dark:border-slate-300 bg-background/50 pl-10 pr-9 text-sm transition-all focus:bg-background"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              title="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        {trimmedQuery && (
          <div className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
            <span>
              Found <strong className="text-foreground">{filteredTasks.length}</strong> matching task
              {filteredTasks.length !== 1 ? "s" : ""}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSearchQuery("")}
              className="h-7 px-2 text-xs"
            >
              Clear
            </Button>
          </div>
        )}
      </div>

      {/* When searching, show filtered results directly */}
      {trimmedQuery ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-2">
            <h2 className="text-lg font-semibold text-foreground">
              Search Results for &ldquo;{searchQuery}&rdquo;
            </h2>
            <Badge variant="secondary" className="font-mono text-xs font-semibold">
              {filteredTasks.length} task{filteredTasks.length !== 1 ? "s" : ""}
            </Badge>
          </div>

          {filteredTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 bg-muted/20 py-16 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <Search className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="mt-4 text-base font-semibold text-foreground">
                No matching tasks found
              </p>
              <p className="mt-1 max-w-md text-xs text-muted-foreground">
                No task matched &ldquo;{searchQuery}&rdquo;. Try searching by Project No (CD...),
                Customer Project No, Client Name, or Designer.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSearchQuery("")}
                className="mt-4"
              >
                Clear Search
              </Button>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
              <div className="hidden grid-cols-[16px_minmax(0,1fr)_140px_100px_80px_80px] items-center gap-4 border-b border-border bg-muted/30 px-4 py-2.5 text-xs font-medium text-muted-foreground lg:grid">
                <span />
                <span>Task & Project Numbers</span>
                <span>{canManage ? "Client" : "Customer Code"}</span>
                <span>Speed</span>
                <span>Status</span>
                <span className="text-right">Age</span>
              </div>
              <div className="divide-y divide-border">
                {filteredTasks.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    priority={task.priority}
                    showDesigner={canManage}
                    canManage={canManage}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Stats strip */}
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {metrics.map((m) => (
              <StatCard key={m.label} metric={m} />
            ))}
          </div>

          {/* Urgent signal banner */}
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
                <TaskSection key={sec.id} {...sec} canManage={canManage} />
              ))}
            </div>

            {/* Sidebar */}
            <aside className="space-y-4">
              {recommendedTask && (
                <FocusCard task={recommendedTask} canManage={canManage} />
              )}
              <WorkflowCard tasks={activeTasks} />
            </aside>
          </div>
        </>
      )}
    </div>
  )
}

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

function TaskSection({
  id,
  title,
  desc,
  tasks,
  showDesigner,
  useAutoPriority,
  canManage,
}: {
  id: string
  title: string
  desc: string
  tasks: Task[]
  showDesigner: boolean
  useAutoPriority: boolean
  canManage: boolean
}) {
  return (
    <section id={id} className="scroll-mt-20 space-y-3">
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
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
          <div className="hidden grid-cols-[16px_minmax(0,1fr)_140px_100px_80px_80px] items-center gap-4 border-b border-border bg-muted/30 px-4 py-2.5 text-xs font-medium text-muted-foreground lg:grid">
            <span />
            <span>Task</span>
            {showDesigner ? <span>Designer</span> : <span>{canManage ? "Client" : "Customer Code"}</span>}
            <span>Speed</span>
            <span>Status</span>
            <span className="text-right">Age</span>
          </div>

          <div className="divide-y divide-border">
            {tasks.map((task) => {
              const priority = useAutoPriority
                ? autoPriority(task.created_at)
                : task.priority
              return (
                <TaskRow
                  key={task.id}
                  task={task}
                  priority={priority}
                  showDesigner={showDesigner}
                  canManage={canManage}
                />
              )
            })}
          </div>
        </div>
      )}
    </section>
  )
}

function TaskRow({
  task,
  priority,
  showDesigner,
  canManage,
}: {
  task: Task
  priority: string
  showDesigner: boolean
  canManage: boolean
}) {
  const customerDisplay = canManage
    ? task.client_name
    : task.customer_code
    ? `Code: ${task.customer_code}`
    : "—"

  return (
    <Link
      href={`/tasks/${task.id}`}
      className="group flex items-start gap-3 px-4 py-3.5 transition-colors hover:bg-muted/40 lg:grid lg:grid-cols-[16px_minmax(0,1fr)_140px_100px_80px_80px] lg:items-center lg:gap-4"
    >
      <div className="mt-1 flex shrink-0 items-center lg:mt-0">
        <div
          className={`h-2 w-2 rounded-full ${STATUS_DOT[task.status] ?? "bg-slate-300"}`}
          title={STATUS_LABELS[task.status] || task.status}
        />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-semibold text-foreground group-hover:text-primary">
            {task.customer_project_no ? task.customer_project_no : task.title}
          </p>
          {task.customer_project_no && (
            <Badge variant="outline" className="font-mono text-[10px] text-muted-foreground bg-muted/40">
              Cust Proj: {task.customer_project_no}
            </Badge>
          )}
        </div>
        <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
          {task.cd_project_no && (
            <span className="font-mono font-medium text-primary/80">
              CD Proj: {task.cd_project_no}
            </span>
          )}
          {task.cd_project_no && <span>·</span>}
          <span className="font-mono text-muted-foreground">{task.readable_id}</span>
          <span>·</span>
          <span className="truncate">
            {showDesigner
              ? task.designer_name ?? "Unassigned"
              : customerDisplay}
          </span>
          {task.deadline && (
            <>
              <span>·</span>
              <DeadlineCountdown deadline={task.deadline} status={task.status} />
            </>
          )}
          <span className="ml-auto flex items-center gap-1.5 lg:hidden">
            <Badge
              variant="outline"
              className={`text-[10px] ${SPEED_COLORS[task.speed || "N"] || PRIORITY_COLORS[priority]}`}
            >
              Speed: {task.speed || (priority === "high" ? "U" : "N")}
            </Badge>
            <span className="text-[10px] text-muted-foreground">
              {formatAge(task.created_at)}
            </span>
          </span>
        </div>
      </div>

      <span className="hidden truncate text-sm text-muted-foreground lg:block">
        {showDesigner ? task.designer_name ?? "—" : customerDisplay}
      </span>

      <div className="hidden lg:block">
        <Badge
          variant="outline"
          className={`text-xs ${SPEED_COLORS[task.speed || "N"] || PRIORITY_COLORS[priority]}`}
        >
          Speed: {task.speed || (priority === "high" ? "U" : "N")}
        </Badge>
      </div>

      <div className="hidden lg:block">
        <Badge
          variant="outline"
          className={`text-xs ${STATUS_COLORS[task.status] || "bg-slate-100 text-slate-700"}`}
        >
          {STATUS_LABELS[task.status] || task.status}
        </Badge>
      </div>

      <span className="hidden text-right text-xs text-muted-foreground tabular-nums lg:block">
        {formatAge(task.created_at)}
      </span>
    </Link>
  )
}

function FocusCard({ task, canManage }: { task: Task; canManage: boolean }) {
  return (
    <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 shadow-xs">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <span className="text-xs font-semibold text-primary uppercase">Recommended Focus</span>
      </div>
      <p className="mt-2 font-medium text-foreground">
        {task.customer_project_no || task.title}
      </p>
      <p className="mt-1 text-xs font-mono text-muted-foreground">
        {task.cd_project_no ? `CD: ${task.cd_project_no} · ` : ""}
        {task.client_name}
      </p>
      <Button asChild size="sm" className="mt-3 w-full">
        <Link href={`/tasks/${task.id}`}>Work on this task</Link>
      </Button>
    </div>
  )
}

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
                  {STATUS_LABELS[item.key] || item.key}
                </span>
              </div>
              <span className="font-semibold tabular-nums text-foreground">
                {item.count}
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full transition-all duration-300 ${item.dot}`}
                style={{ width: `${(item.count / max) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
