import Link from "next/link"
import { Suspense } from "react"
import { redirect } from "next/navigation"
import {
  ArrowRight,
  CalendarClock,
  CircleAlert,
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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
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
  tone: string
}

const STATUS_TRACK_COLORS: Record<string, string> = {
  assigned: "bg-slate-400",
  in_progress: "bg-blue-500",
  in_qc_review: "bg-amber-500",
  revision_requested: "bg-destructive",
  client_ready: "bg-emerald-500",
  closed: "bg-slate-500",
}

// --- Utilities ---
function autoPriority(createdAt: string): "low" | "medium" | "high" {
  const hours = (Date.now() - new Date(createdAt).getTime()) / 3_600_000
  if (hours < 8) return "low"
  if (hours < 16) return "medium"
  return "high"
}

function formatAge(createdAt: string): string {
  const minutes = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60_000)
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`
}

function formatDeadline(deadline: string | null): string {
  if (!deadline) return "No deadline"
  return new Date(deadline).toLocaleDateString("en-IN", { day: "numeric", month: "short" })
}

export default async function TasksPage() {
  const session = await getSession()
  if (!session) redirect("/login")

  const canManage = session.roles.includes("manager") || session.roles.includes("qc")
  const roleLabel = session.roles.includes("manager") ? "Manager" : session.roles.includes("qc") ? "QC" : "Designer"

  return (
    <main className="min-h-full bg-background">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-4 sm:p-6 lg:p-8">
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

async function TasksWorkspace({ session, canManage }: { session: SessionUser; canManage: boolean }) {
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

  const highPriorityQueueCount = unassignedTasks.filter((t) => autoPriority(t.created_at) === "high").length
  const needsAttention = allTasks.filter((t) => t.status === "revision_requested" || (t.is_unassigned && autoPriority(t.created_at) === "high")).length

  const metrics: Metric[] = [
    { label: "My tasks", value: myTasks.length, note: "Assigned work on your plate", icon: ClipboardList, tone: "bg-primary/10 text-primary" },
    { label: "Open queue", value: unassignedTasks.length, note: "Tasks ready to be claimed", icon: InboxIcon, tone: "bg-blue-500/10 text-blue-600" },
    { label: "Needs attention", value: needsAttention, note: "Revisions or urgent items", icon: CircleAlert, tone: "bg-amber-500/10 text-amber-600" },
    canManage
      ? { label: "Team coverage", value: teamTasks.length, note: "Active team workflows", icon: Users, tone: "bg-emerald-500/10 text-emerald-600" }
      : { label: "In QC", value: allTasks.filter(t => t.status === "in_qc_review").length, note: "Tasks waiting in review", icon: ShieldCheck, tone: "bg-emerald-500/10 text-emerald-600" },
  ]

  const recommendedTask = myTasks[0] ?? unassignedTasks.find(t => autoPriority(t.created_at) === "high") ?? unassignedTasks[0] ?? (canManage ? teamTasks[0] : null)

  const sections = [
    { id: "my-tasks", title: "My tasks", desc: "Work you own, ordered by urgency.", tasks: myTasks, showDesigner: false, autoPriority: false },
    { id: "open-queue", title: "Open queue", desc: "Unassigned work. Priorities age up every 8h.", tasks: unassignedTasks, showDesigner: false, autoPriority: true },
    ...(canManage ? [{ id: "team-tasks", title: "Team tasks", desc: "Live visibility into team blockers.", tasks: teamTasks, showDesigner: true, autoPriority: false }] : [])
  ]

  return (
    <>
      <OverviewGrid metrics={metrics} highPriorityCount={highPriorityQueueCount} />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-8">
          {sections.map((sec) => (
            <TaskSectionCard key={sec.id} {...sec} />
          ))}
        </div>
        <aside className="flex flex-col gap-6">
          <FocusCard recommendation={recommendedTask} />
          <WorkflowPulseCard tasks={allTasks} />
          <BoardRulesCard canManage={canManage} />
        </aside>
      </div>
    </>
  )
}

function TasksHeader({ firstName, roleLabel, canManage }: { firstName: string; roleLabel: string; canManage: boolean }) {
  return (
    <Card className="overflow-hidden border-border/50 shadow-sm">
      <CardHeader className="gap-6 bg-gradient-to-r from-muted/30 to-background pb-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <Badge variant="outline" className="bg-background">{roleLabel}</Badge>
            <div>
              <h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
                Keep delivery moving, {firstName}
              </h1>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground sm:text-base">
                Your command center for active assignments, open queues, and team velocity.
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button asChild size="default">
              <Link href={canManage ? "/tasks/new" : "#open-queue"}>
                {canManage ? <><PlusSquare className="mr-2 h-4 w-4" /> Create task</> : "Review open queue"}
              </Link>
            </Button>
          </div>
        </div>
      </CardHeader>
    </Card>
  )
}

function OverviewGrid({ metrics, highPriorityCount }: { metrics: Metric[]; highPriorityCount: number }) {
  return (
    <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((m) => (
          <Card key={m.label} className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <p className="text-sm font-medium text-muted-foreground">{m.label}</p>
              <m.icon className={`h-4 w-4 ${m.tone.split(" ")[1]}`} />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{m.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{m.note}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card className="shadow-sm bg-primary/5 border-primary/10">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" /> Urgent Queue Signals
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-baseline gap-3">
            <p className="text-3xl font-bold text-primary">{highPriorityCount}</p>
            <p className="text-xs text-muted-foreground">Auto-escalated items waiting</p>
          </div>
        </CardContent>
      </Card>
    </section>
  )
}

function TaskSectionCard({ id, title, desc, tasks, showDesigner, autoPriority: useAuto }: any) {
  return (
    <section id={id} className="scroll-mt-20 space-y-4">
      <div>
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">{title}</h2>
          <Badge variant="secondary" className="rounded-full">{tasks.length}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">{desc}</p>
      </div>

      {tasks.length === 0 ? (
        <Empty className="rounded-xl border border-dashed py-12">
          <EmptyHeader>
            <EmptyTitle>No tasks here</EmptyTitle>
            <EmptyDescription>This queue is currently clear.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <Card className="overflow-hidden shadow-sm">
          <Table>
            <TableHeader className="bg-muted/40 hidden lg:table-header-group">
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Task</TableHead>
                <TableHead>Client</TableHead>
                {showDesigner && <TableHead>Designer</TableHead>}
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Age</TableHead>
                <TableHead>Deadline</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="grid lg:table-row-group gap-4 p-4 lg:p-0">
              {tasks.map((t: Task) => {
                const priority = useAuto ? autoPriority(t.created_at) : t.priority
                return (
                  <TableRow key={t.id} className="flex flex-col lg:table-row rounded-lg border lg:border-0 lg:border-b p-4 lg:p-0">
                    <TableCell className="font-mono text-xs"><Link href={`/tasks/${t.id}`}>{t.readable_id}</Link></TableCell>
                    <TableCell className="font-medium"><Link href={`/tasks/${t.id}`}>{t.title}</Link></TableCell>
                    <TableCell className="text-muted-foreground text-sm">{t.client_name}</TableCell>
                    {showDesigner && <TableCell className="text-sm">{t.designer_name ?? "—"}</TableCell>}
                    <TableCell>
                      <Badge variant="outline" className={PRIORITY_COLORS[priority]}>{priority}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={STATUS_COLORS[t.status]}>{STATUS_LABELS[t.status]}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatAge(t.created_at)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDeadline(t.deadline)}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </Card>
      )}
    </section>
  )
}

function FocusCard({ recommendation }: { recommendation: Task | null }) {
  if (!recommendation) return null
  return (
    <Card className="shadow-sm border-primary/20 bg-primary/5">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" /> Recommended Next
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Link href={`/tasks/${recommendation.id}`} className="font-medium hover:underline block">
            {recommendation.title}
          </Link>
          <p className="text-xs text-muted-foreground mt-1">
            {recommendation.readable_id} • {recommendation.client_name}
          </p>
        </div>
        <Button asChild className="w-full" size="sm">
          <Link href={`/tasks/${recommendation.id}`}>Open Task <ArrowRight className="ml-2 h-3 w-3" /></Link>
        </Button>
      </CardContent>
    </Card>
  )
}

function WorkflowPulseCard({ tasks }: { tasks: Task[] }) {
  const statuses = ["revision_requested", "assigned", "in_progress", "in_qc_review"]
  const summary = statuses.map(s => ({ status: s, count: tasks.filter(t => t.status === s).length }))
  const max = Math.max(...summary.map(s => s.count), 1)

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Layers3 className="h-4 w-4 text-primary" /> Active Workflow
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {summary.map((item) => (
          <div key={item.status} className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">{STATUS_LABELS[item.status]}</span>
              <span className="font-medium">{item.count}</span>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full ${STATUS_TRACK_COLORS[item.status]}`}
                style={{ width: `${Math.max((item.count / max) * 100, 5)}%` }}
              />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function BoardRulesCard({ canManage }: { canManage: boolean }) {
  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">Board Rules</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="flex gap-3 text-muted-foreground">
          <InboxIcon className="h-4 w-4 shrink-0 text-foreground" />
          <p>Unassigned tasks escalate in priority every 8 hours.</p>
        </div>
        <div className="flex gap-3 text-muted-foreground">
          <CircleAlert className="h-4 w-4 shrink-0 text-foreground" />
          <p>Revisions float to the top of all queues automatically.</p>
        </div>
      </CardContent>
    </Card>
  )
}

function TasksPageSkeleton({ canManage }: { canManage: boolean }) {
  return (
    <>
      {/* PERFECT Grid Match Skeleton */}
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="shadow-sm">
              <CardHeader className="pb-2"><Skeleton className="h-4 w-20" /></CardHeader>
              <CardContent><Skeleton className="h-8 w-12" /></CardContent>
            </Card>
          ))}
        </div>
        <Card className="shadow-sm"><CardContent className="pt-6"><Skeleton className="h-12 w-full" /></CardContent></Card>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px] mt-6">
        <div className="space-y-8">
          <Skeleton className="h-[300px] w-full rounded-xl" />
          <Skeleton className="h-[300px] w-full rounded-xl" />
          {canManage && <Skeleton className="h-[300px] w-full rounded-xl" />}
        </div>
        <aside className="space-y-6">
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </aside>
      </div>
    </>
  )
}