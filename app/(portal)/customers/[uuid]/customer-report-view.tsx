"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import {
  Calendar,
  CheckCircle2,
  Clock,
  ChevronDown,
  ChevronUp,
  FileText,
  User,
  ArrowLeft,
  Search,
  Award,
  Layers,
  Check,
  History,
  XCircle,
  AlertCircle
} from "lucide-react"
import { CustomerTaskReportItem, TaskHistorySubmission } from "./page"
import { formatDateTimeDisplay, formatDateDisplay, STATUS_COLORS, STATUS_LABELS } from "@/lib/task-utils"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

interface CustomerReportViewProps {
  customer: {
    uuid: string
    code: string
    name: string
    created_at: string
  }
  initialTasks: CustomerTaskReportItem[]
}

export function CustomerReportView({ customer, initialTasks }: CustomerReportViewProps) {
  const [selectedMonth, setSelectedMonth] = useState<string>("current")
  const [searchQuery, setSearchQuery] = useState<string>("")
  const [expandedTaskIds, setExpandedTaskIds] = useState<Record<string, boolean>>({})
  const [viewFilter, setViewFilter] = useState<"closed" | "all">("closed")

  // Generate month options based on task timestamps
  const monthOptions = useMemo(() => {
    const monthsSet = new Set<string>()
    const now = new Date()
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
    monthsSet.add(currentMonthKey)

    initialTasks.forEach((task) => {
      const dateStr = task.closed_at || task.created_at
      if (dateStr) {
        const d = new Date(dateStr)
        if (!isNaN(d.getTime())) {
          const mKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
          monthsSet.add(mKey)
        }
      }
    })

    const sorted = Array.from(monthsSet).sort().reverse()
    return sorted
  }, [initialTasks])

  // Filter tasks based on month, view (closed vs all), and search query
  const filteredTasks = useMemo(() => {
    return initialTasks.filter((task) => {
      // Status filter
      if (viewFilter === "closed" && task.status !== "closed") {
        return false
      }

      // Month filter
      if (selectedMonth !== "all") {
        const targetMonth = selectedMonth === "current"
          ? `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`
          : selectedMonth

        const dateStr = task.closed_at || task.created_at
        if (!dateStr) return false
        const d = new Date(dateStr)
        if (isNaN(d.getTime())) return false
        const taskMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
        if (taskMonth !== targetMonth) return false
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const matchTitle = task.title.toLowerCase().includes(q)
        const matchCd = (task.cd_project_no || "").toLowerCase().includes(q)
        const matchCustProj = (task.customer_project_no || "").toLowerCase().includes(q)
        const matchReadable = (task.readable_id || "").toLowerCase().includes(q)
        const matchDesigner = (task.designer_name || "").toLowerCase().includes(q)
        if (!matchTitle && !matchCd && !matchCustProj && !matchReadable && !matchDesigner) {
          return false
        }
      }

      return true
    })
  }, [initialTasks, selectedMonth, viewFilter, searchQuery])

  // Summary Metrics
  const metrics = useMemo(() => {
    const closedTasks = filteredTasks.filter((t) => t.status === "closed")
    const totalDone = closedTasks.length
    const totalPoints = closedTasks.reduce((sum, t) => sum + (t.points || 0), 0)
    const allCount = filteredTasks.length

    return {
      totalDone,
      totalPoints,
      allCount,
    }
  }, [filteredTasks])

  const toggleExpand = (taskId: string) => {
    setExpandedTaskIds((prev) => ({
      ...prev,
      [taskId]: !prev[taskId],
    }))
  }

  const formatMonthLabel = (mKey: string) => {
    if (mKey === "all") return "All Time"
    const [year, month] = mKey.split("-")
    const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1)
    return date.toLocaleDateString("en-US", { month: "long", year: "numeric" })
  }

  return (
    <div className="mt-6 space-y-6">
      {/* Back Button */}
      <div className="flex items-center justify-between">
        <Link
          href="/customers"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Customers Directory
        </Link>
      </div>

      {/* Filter Header & Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 rounded-2xl border border-border bg-card p-4 shadow-xs">
        <div className="flex flex-wrap items-center gap-3">
          {/* Month Selector */}
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="h-9 rounded-lg border border-input bg-background px-3 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="current">Current Month ({formatMonthLabel(`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`)})</option>
              <option value="all">All Months</option>
              {monthOptions.map((mKey) => (
                <option key={mKey} value={mKey}>
                  {formatMonthLabel(mKey)}
                </option>
              ))}
            </select>
          </div>

          {/* View Filter Toggle */}
          <div className="flex items-center rounded-lg border border-border bg-muted/50 p-1">
            <button
              onClick={() => setViewFilter("closed")}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                viewFilter === "closed"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Closed Tasks Only
            </button>
            <button
              onClick={() => setViewFilter("all")}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                viewFilter === "all"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              All Tasks ({initialTasks.length})
            </button>
          </div>
        </div>

        {/* Search Bar with Black Border */}
        <div className="relative min-w-[240px] sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search tasks or project no..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-9 border-2 border-black dark:border-slate-300 bg-background/50 pl-9 pr-8 text-xs focus:bg-background"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {/* Closed Tasks Done */}
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              Tasks Completed
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-heading text-2xl font-bold text-foreground">
              {metrics.totalDone}
            </span>
            <span className="text-xs text-muted-foreground">tasks finished</span>
          </div>
        </div>

        {/* Total Points */}
        <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
              Total Points Generated
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <Award className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-heading text-2xl font-bold text-foreground">
              {metrics.totalPoints.toFixed(1)}
            </span>
            <span className="text-xs text-muted-foreground">points</span>
          </div>
        </div>

        {/* Total Tasks In Filter */}
        <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-4 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-purple-600 dark:text-purple-400">
              Total Tasks Recorded
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400">
              <Layers className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-heading text-2xl font-bold text-foreground">
              {metrics.allCount}
            </span>
            <span className="text-xs text-muted-foreground">in current filter</span>
          </div>
        </div>
      </div>

      {/* Closed Tasks Table / List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-heading text-base font-semibold text-foreground flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            {viewFilter === "closed" ? "Closed Tasks & History" : "All Customer Tasks"} ({filteredTasks.length})
          </h3>
          <span className="text-xs text-muted-foreground">
            Showing tasks finished with timestamps and submission history
          </span>
        </div>

        {filteredTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/50 p-12 text-center">
            <CheckCircle2 className="h-10 w-10 text-muted-foreground/50" />
            <p className="mt-3 text-sm font-medium text-foreground">No tasks found</p>
            <p className="mt-1 text-xs text-muted-foreground">
              No tasks match your selected month or search filter.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredTasks.map((task) => {
              const isExpanded = !!expandedTaskIds[task.id]
              const finishedTimestamp = task.closed_at
                ? formatDateTimeDisplay(task.closed_at)
                : (task.submissions && task.submissions.length > 0
                    ? formatDateTimeDisplay(task.submissions[task.submissions.length - 1].submitted_at)
                    : formatDateTimeDisplay(task.created_at))

              return (
                <div
                  key={task.id}
                  className="overflow-hidden rounded-xl border border-border bg-card shadow-xs transition-all hover:border-primary/30"
                >
                  {/* Task Card Header / Primary Row */}
                  <div className="p-4 sm:p-5">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      {/* Left: Project identifiers & Title */}
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs font-bold text-primary">
                            {task.cd_project_no || task.readable_id || task.id.slice(0, 8)}
                          </span>
                          {task.customer_project_no && (
                            <span className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                              Ref: {task.customer_project_no}
                            </span>
                          )}
                          <Badge variant="outline" className={STATUS_COLORS[task.status] || ""}>
                            {STATUS_LABELS[task.status] || task.status}
                          </Badge>
                          {task.version && (
                            <Badge variant="secondary" className="font-mono text-[10px]">
                              {task.version}
                            </Badge>
                          )}
                          {task.speed === "U" && (
                            <Badge variant="destructive" className="text-[10px]">
                              Urgent
                            </Badge>
                          )}
                        </div>
                        <h4 className="font-heading text-base font-semibold text-foreground">
                          {task.title}
                        </h4>
                      </div>

                      {/* Right: Finished Date & Time + Designer */}
                      <div className="flex flex-wrap items-center gap-4 border-t border-border/60 pt-3 lg:border-t-0 lg:pt-0">
                        {/* Designer */}
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <User className="h-3.5 w-3.5" />
                          <span>Designer: </span>
                          <span className="font-medium text-foreground">
                            {task.designer_name || "Unassigned"}
                          </span>
                        </div>

                        {/* Date & Time Finished */}
                        <div className="flex items-center gap-1.5 rounded-lg bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                          <Clock className="h-3.5 w-3.5" />
                          <span>Finished: {finishedTimestamp}</span>
                        </div>

                        {/* History Toggle Button */}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleExpand(task.id)}
                          className="h-8 gap-1.5 text-xs font-medium"
                        >
                          <History className="h-3.5 w-3.5 text-primary" />
                          <span>History ({task.submissions.length})</span>
                          {isExpanded ? (
                            <ChevronUp className="h-3.5 w-3.5" />
                          ) : (
                            <ChevronDown className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </div>
                    </div>

                    {/* Metadata Sub-bar */}
                    <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-muted-foreground border-t border-border/40 pt-2">
                      <span>Points: <strong className="text-foreground">{task.points}</strong></span>
                      {task.category_code && <span>Category: <strong className="text-foreground">{task.category_code}</strong></span>}
                      {task.work_type && <span>Work Type: <strong className="text-foreground">{task.work_type}</strong></span>}
                      {task.request_date && <span>Requested: <strong className="text-foreground">{formatDateDisplay(task.request_date)}</strong></span>}
                    </div>
                  </div>

                  {/* Expandable Submission History Timeline */}
                  {isExpanded && (
                    <div className="border-t border-border bg-muted/20 p-4 sm:p-5">
                      <h5 className="font-heading text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4 flex items-center gap-1.5">
                        <History className="h-3.5 w-3.5 text-primary" />
                        Submission & Review History Timeline
                      </h5>

                      {task.submissions.length === 0 ? (
                        <p className="text-xs text-muted-foreground italic">
                          No submission iterations recorded for this task.
                        </p>
                      ) : (
                        <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-border">
                          {task.submissions.map((sub, idx) => {
                            const isApproved = sub.outcome === "approved"
                            const isSentBack = sub.outcome === "sent_back"

                            return (
                              <div key={sub.id} className="relative group">
                                {/* Timeline Dot */}
                                <div
                                  className={`absolute -left-6 top-1 flex h-5 w-5 items-center justify-center rounded-full text-white text-[10px] ${
                                    isApproved
                                      ? "bg-emerald-500"
                                      : isSentBack
                                      ? "bg-red-500"
                                      : "bg-blue-500"
                                  }`}
                                >
                                  {isApproved ? (
                                    <Check className="h-3 w-3" />
                                  ) : isSentBack ? (
                                    <XCircle className="h-3 w-3" />
                                  ) : (
                                    <AlertCircle className="h-3 w-3" />
                                  )}
                                </div>

                                {/* Submission Details Box */}
                                <div className="rounded-lg border border-border bg-card p-3 shadow-xs space-y-2">
                                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 pb-2">
                                    <div className="flex items-center gap-2">
                                      <Badge variant="outline" className="font-mono font-bold text-xs">
                                        {sub.version}
                                      </Badge>
                                      <span className="text-xs font-semibold text-foreground">
                                        Submitted by {sub.submitter_name || "Designer"}
                                      </span>
                                    </div>
                                    <span className="text-xs text-muted-foreground font-mono">
                                      {formatDateTimeDisplay(sub.submitted_at)}
                                    </span>
                                  </div>

                                  {/* Outcome & Reviewer */}
                                  <div className="flex flex-wrap items-center gap-3 text-xs">
                                    <span>Outcome: </span>
                                    <Badge
                                      className={
                                        isApproved
                                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                                          : isSentBack
                                          ? "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20"
                                          : "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20"
                                      }
                                    >
                                      {sub.outcome === "approved"
                                        ? "Approved"
                                        : sub.outcome === "sent_back"
                                        ? "Sent Back for Revision"
                                        : sub.outcome}
                                    </Badge>

                                    {sub.reviewer_name && (
                                      <span className="text-muted-foreground">
                                        Reviewed by: <strong className="text-foreground">{sub.reviewer_name}</strong>
                                      </span>
                                    )}
                                  </div>

                                  {/* Notes & Remarks */}
                                  {sub.designer_notes && (
                                    <div className="rounded bg-muted/50 p-2 text-xs text-muted-foreground">
                                      <strong className="text-foreground">Designer Notes: </strong>
                                      {sub.designer_notes}
                                    </div>
                                  )}

                                  {sub.remarks && (
                                    <div className="rounded bg-red-500/5 border border-red-500/20 p-2 text-xs text-red-700 dark:text-red-300">
                                      <strong className="font-semibold">QC Remarks: </strong>
                                      {sub.remarks}
                                    </div>
                                  )}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
