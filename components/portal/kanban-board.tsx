"use client"

import { useState } from "react"
import Link from "next/link"
import {
  Kanban,
  UserCheck,
  Search,
  Clock,
  User,
  ShieldCheck,
  Timer,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  Filter,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  STATUS_LABELS,
  STATUS_LABELS_FULL,
  STATUS_COLORS,
  PRIORITY_COLORS,
  SPEED_COLORS,
} from "@/lib/task-utils"

export type KanbanTask = {
  id: string
  readable_id: string
  title: string
  customer_project_no: string | null
  cd_project_no: string | null
  speed: string | null
  status: string
  priority: string
  deadline: string | null
  assigned_to: string | null
  designer_name?: string | null
  client_name?: string | null
  created_at?: string
}

export type Designer = {
  id: string
  name: string
}

const STAGES = [
  { key: "assigned", label: "Assigned", icon: UserCheck, color: "border-slate-400/30 text-slate-600 dark:text-slate-400 bg-slate-500/10" },
  { key: "in_progress", label: "In Progress", icon: Timer, color: "border-blue-500/30 text-blue-600 dark:text-blue-400 bg-blue-500/10" },
  { key: "in_qc_review", label: "In QC Review", icon: ShieldCheck, color: "border-amber-500/30 text-amber-600 dark:text-amber-400 bg-amber-500/10" },
  { key: "revision_requested", label: "Revision", icon: AlertCircle, color: "border-red-500/30 text-red-600 dark:text-red-400 bg-red-500/10" },
  { key: "client_ready", label: "Client Ready", icon: CheckCircle2, color: "border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10" },
  { key: "closed", label: "Closed", icon: FileSpreadsheet, color: "border-slate-400/30 text-slate-500 bg-slate-500/5" },
]

function formatDeadline(deadline: string | null): string {
  if (!deadline) return "—"
  return new Date(deadline).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  })
}

export function KanbanBoard({
  tasks,
  designers,
}: {
  tasks: KanbanTask[]
  designers: Designer[]
}) {
  const [viewMode, setViewMode] = useState<"stage" | "designer">("stage")
  const [searchQuery, setSearchQuery] = useState("")

  // Mobile selection states
  const [selectedStage, setSelectedStage] = useState<string>("all")
  const [selectedDesigner, setSelectedDesigner] = useState<string>("all")

  const filteredTasks = tasks.filter((t) => {
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase()
    return (
      (t.readable_id && t.readable_id.toLowerCase().includes(q)) ||
      (t.customer_project_no && t.customer_project_no.toLowerCase().includes(q)) ||
      (t.cd_project_no && t.cd_project_no.toLowerCase().includes(q)) ||
      (t.title && t.title.toLowerCase().includes(q)) ||
      (t.designer_name && t.designer_name.toLowerCase().includes(q)) ||
      (t.client_name && t.client_name.toLowerCase().includes(q))
    )
  })

  // Grouping by stage
  const tasksByStage = STAGES.map((stage) => ({
    ...stage,
    tasks: filteredTasks.filter((t) => t.status === stage.key),
  }))

  // Grouping by designer
  const unassignedTasks = filteredTasks.filter(
    (t) => !t.assigned_to || t.assigned_to === ""
  )

  const tasksByDesigner = designers.map((d) => ({
    id: d.id,
    name: d.name,
    tasks: filteredTasks.filter((t) => t.assigned_to === d.id),
  }))

  if (unassignedTasks.length > 0) {
    tasksByDesigner.unshift({
      id: "unassigned",
      name: "Unassigned",
      tasks: unassignedTasks,
    })
  }

  // Active columns to render based on mobile filter selection or full desktop view
  const visibleStageColumns =
    selectedStage === "all"
      ? tasksByStage
      : tasksByStage.filter((col) => col.key === selectedStage)

  const visibleDesignerColumns =
    selectedDesigner === "all"
      ? tasksByDesigner
      : tasksByDesigner.filter((col) => col.id === selectedDesigner)

  return (
    <div className="space-y-4">
      {/* Header controls toolbar */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            {/* View Switcher: By Stage / By Designer */}
            <div className="inline-flex rounded-lg border border-border bg-muted/50 p-1">
              <button
                suppressHydrationWarning
                onClick={() => setViewMode("stage")}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
                  viewMode === "stage"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Kanban className="h-3.5 w-3.5" />
                By Stage
              </button>
              <button
                suppressHydrationWarning
                onClick={() => setViewMode("designer")}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
                  viewMode === "designer"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <User className="h-3.5 w-3.5" />
                By Designer
              </button>
            </div>

            <span className="text-xs font-medium text-muted-foreground">
              {filteredTasks.length} {filteredTasks.length === 1 ? "task" : "tasks"}
            </span>
          </div>

          {/* Search input */}
          <div className="relative min-w-[200px] sm:max-w-xs">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              suppressHydrationWarning
              placeholder="Search tasks or designers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8.5 pl-8 text-xs"
            />
          </div>
        </div>

        {/* Mobile Column Selectors (visible on mobile screens, optional on desktop for quick filtering) */}
        <div className="flex items-center gap-2 sm:hidden">
          <Filter className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          {viewMode === "stage" ? (
            <select
              value={selectedStage}
              onChange={(e) => setSelectedStage(e.target.value)}
              className="h-9 w-full rounded-lg border border-border bg-card px-3 text-xs font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="all">
                All Stages ({filteredTasks.length})
              </option>
              {tasksByStage.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label} ({s.tasks.length})
                </option>
              ))}
            </select>
          ) : (
            <select
              value={selectedDesigner}
              onChange={(e) => setSelectedDesigner(e.target.value)}
              className="h-9 w-full rounded-lg border border-border bg-card px-3 text-xs font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="all">
                All Designers ({filteredTasks.length})
              </option>
              {tasksByDesigner.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.tasks.length})
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Kanban Board Container:
          - Mobile: Vertical stack without horizontal scrolling (`flex flex-col gap-4 w-full`)
          - Desktop (sm+ & 4K): Responsive Grid layout (`grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 w-full`)
      */}
      <div className="w-full">
        {viewMode === "stage" ? (
          <div className="flex flex-col gap-4 w-full sm:grid sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
            {visibleStageColumns.map((column) => (
              <KanbanColumn
                key={column.key}
                title={column.label}
                count={column.tasks.length}
                headerBadgeClass={column.color}
                tasks={column.tasks}
                viewMode="stage"
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-4 w-full sm:grid sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6">
            {visibleDesignerColumns.map((column) => (
              <KanbanColumn
                key={column.id}
                title={column.name}
                count={column.tasks.length}
                headerBadgeClass={
                  column.id === "unassigned"
                    ? "border-amber-500/30 text-amber-600 bg-amber-500/10"
                    : "border-primary/30 text-primary bg-primary/10"
                }
                tasks={column.tasks}
                viewMode="designer"
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function KanbanColumn({
  title,
  count,
  headerBadgeClass,
  tasks,
  viewMode,
}: {
  title: string
  count: number
  headerBadgeClass: string
  tasks: KanbanTask[]
  viewMode: "stage" | "designer"
}) {
  return (
    <div className="flex w-full shrink-0 flex-col rounded-xl border border-border/80 bg-muted/20">
      {/* Column Header */}
      <div className="flex items-center justify-between border-b border-border/60 px-3.5 py-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-foreground">{title}</span>
          <span
            className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full border px-1.5 text-[11px] font-bold ${headerBadgeClass}`}
          >
            {count}
          </span>
        </div>
      </div>

      {/* Cards List */}
      <div className="flex min-h-[140px] flex-1 flex-col gap-2.5 p-2.5">
        {tasks.length === 0 ? (
          <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-border/60 p-4 text-center">
            <span className="text-xs text-muted-foreground/70">No tasks</span>
          </div>
        ) : (
          tasks.map((task) => (
            <TaskCard key={task.id} task={task} viewMode={viewMode} />
          ))
        )}
      </div>
    </div>
  )
}

function TaskCard({
  task,
  viewMode,
}: {
  task: KanbanTask
  viewMode: "stage" | "designer"
}) {
  return (
    <Link
      href={`/tasks/${task.id}`}
      className="group relative flex flex-col justify-between rounded-lg border border-border bg-card p-3 shadow-2xs transition-all hover:border-primary/50 hover:shadow-xs"
    >
      <div>
        {/* Top Meta: ID & Speed/Priority */}
        <div className="flex items-center justify-between gap-1.5 text-[11px]">
          <span className="font-mono font-medium text-muted-foreground group-hover:text-primary">
            {task.cd_project_no || task.readable_id}
          </span>
          <Badge
            variant="outline"
            className={`text-[10px] px-1.5 py-0 ${
              SPEED_COLORS[task.speed || "N"] ||
              PRIORITY_COLORS[task.priority] ||
              ""
            }`}
          >
            Speed: {task.speed || (task.priority === "high" ? "U" : "N")}
          </Badge>
        </div>

        {/* Task Title / Project # */}
        <h4 className="mt-1.5 line-clamp-2 text-xs font-semibold text-foreground group-hover:text-primary">
          {task.customer_project_no || task.title}
        </h4>

        {/* Client Name if present */}
        {task.client_name && (
          <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
            {task.client_name}
          </p>
        )}
      </div>

      {/* Bottom Metadata & Badges */}
      <div className="mt-3 flex items-center justify-between gap-2 border-t border-border/40 pt-2 text-[11px] text-muted-foreground">
        {/* VIEW SPECIFIC BADGE:
            If in Designer mode: Show Stage/Status badge
            If in Stage mode: Show Assigned Designer name badge
        */}
        {viewMode === "designer" ? (
          <Badge
            variant="outline"
            className={`text-[10px] px-1.5 py-0 font-medium ${
              STATUS_COLORS[task.status] ?? ""
            }`}
          >
            {STATUS_LABELS_FULL[task.status] ?? STATUS_LABELS[task.status] ?? task.status}
          </Badge>
        ) : (
          <div className="flex items-center gap-1 min-w-0 truncate text-xs">
            <User className="h-3 w-3 shrink-0 text-muted-foreground" />
            <span className="truncate text-foreground/80 font-medium">
              {task.designer_name || "Unassigned"}
            </span>
          </div>
        )}

        {/* Deadline */}
        {task.deadline && (
          <div className="flex shrink-0 items-center gap-1 text-[11px]">
            <Clock className="h-3 w-3" />
            <span>{formatDeadline(task.deadline)}</span>
          </div>
        )}
      </div>
    </Link>
  )
}
