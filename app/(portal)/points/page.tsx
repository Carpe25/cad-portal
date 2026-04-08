import Link from "next/link"
import { Suspense } from "react"
import { getSession } from "@/lib/session"
import { redirect } from "next/navigation"
import { sql } from "@/lib/db"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Hash, Layers3, Zap } from "lucide-react"
import { PageHeader } from "@/components/portal/page-header"
import { StatCard } from "@/components/portal/stat-card"
import { EmptyState } from "@/components/portal/empty-state"

type PointEntry = {
  id: string
  task_id: string
  task_title: string
  readable_id: string
  points: number
  credited_at: string
  month: string
  designer_name: string
}

export default async function PointsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; user?: string }>
}) {
  const session = await getSession()
  if (!session) redirect("/login")

  const isManager = session.roles.includes("manager")
  const roleLabel = isManager ? "Manager" : "Designer"

  return (
    <main className="min-h-full">
      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <PageHeader
          roleLabel={roleLabel}
          title="Points Log"
          description={
            isManager ? "All designer earnings." : "Your earned points."
          }
        />
        <Suspense fallback={<PointsSkeleton />}>
          <PointsContent
            sessionId={session.id}
            isManager={isManager}
            searchParams={searchParams}
          />
        </Suspense>
      </div>
    </main>
  )
}

async function PointsContent({
  sessionId,
  isManager,
  searchParams,
}: {
  sessionId: string
  isManager: boolean
  searchParams: Promise<{ month?: string; user?: string }>
}) {
  const params = await searchParams
  const month = params.month ?? new Date().toISOString().slice(0, 7)
  const filterUserId = isManager ? (params.user ?? null) : sessionId

  const entries = filterUserId
    ? ((await sql`
        SELECT pl.id, pl.task_id, t.title AS task_title, t.readable_id, pl.points,
               pl.credited_at, pl.month, u.name AS designer_name
        FROM points_log pl
        JOIN tasks t ON pl.task_id = t.id
        JOIN users u ON pl.user_id = u.id
        WHERE pl.user_id = ${filterUserId} AND pl.month = ${month}
        ORDER BY pl.credited_at DESC
      `) as PointEntry[])
    : ((await sql`
        SELECT pl.id, pl.task_id, t.title AS task_title, t.readable_id, pl.points,
               pl.credited_at, pl.month, u.name AS designer_name
        FROM points_log pl
        JOIN tasks t ON pl.task_id = t.id
        JOIN users u ON pl.user_id = u.id
        WHERE pl.month = ${month}
        ORDER BY pl.credited_at DESC
      `) as PointEntry[])

  const total = entries.reduce((sum, e) => sum + e.points, 0)

  const designers = isManager
    ? ((await sql`SELECT id, name FROM users WHERE roles @> ARRAY['designer']::text[] AND active = true ORDER BY name`) as {
        id: string
        name: string
      }[])
    : []

  return (
    <div className="mt-8 space-y-8">
      {/* Filter bar */}
      <form className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input
          type="month"
          name="month"
          defaultValue={month}
          className="w-auto"
        />
        {isManager && (
          <NativeSelect name="user" defaultValue={filterUserId ?? ""}>
            <NativeSelectOption value="">All Designers</NativeSelectOption>
            {designers.map((d) => (
              <NativeSelectOption key={d.id} value={d.id}>
                {d.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        )}
        <Button type="submit" size="sm">
          Filter
        </Button>
      </form>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard
          label="Total Points"
          value={total}
          note={`For ${month}`}
          icon={Zap}
          accent="text-primary"
        />
        <StatCard
          label="Entries"
          value={entries.length}
          note="Tasks credited"
          icon={Layers3}
          accent="text-blue-500"
        />
      </div>

      {/* Table */}
      {entries.length === 0 ? (
        <EmptyState icon={Hash} description={`No points earned in ${month}.`} />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
          {/* Desktop column headers */}
          <div
            className={`hidden items-center gap-4 border-b border-border bg-muted/30 px-4 py-2.5 text-xs font-medium text-muted-foreground lg:grid ${
              isManager
                ? "grid-cols-[140px_minmax(0,1fr)_100px_80px_120px]"
                : "grid-cols-[minmax(0,1fr)_100px_80px_120px]"
            }`}
          >
            {isManager && <span>Designer</span>}
            <span>Task</span>
            <span>Task ID</span>
            <span className="text-right">Points</span>
            <span>Credited On</span>
          </div>

          <div className="divide-y divide-border">
            {entries.map((e) => (
              <Link
                key={e.id}
                href={`/tasks/${e.task_id}`}
                className={`group flex items-start gap-3 px-4 py-3.5 transition-colors hover:bg-muted/40 lg:grid lg:items-center lg:gap-4 ${
                  isManager
                    ? "lg:grid-cols-[140px_minmax(0,1fr)_100px_80px_120px]"
                    : "lg:grid-cols-[minmax(0,1fr)_100px_80px_120px]"
                }`}
              >
                {isManager && (
                  <span className="hidden text-sm font-medium text-foreground lg:block">
                    {e.designer_name}
                  </span>
                )}

                {/* Title + meta */}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground group-hover:text-primary">
                    {e.task_title}
                  </p>
                  <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="font-mono">{e.readable_id}</span>
                    {isManager && (
                      <>
                        <span>·</span>
                        <span className="lg:hidden">{e.designer_name}</span>
                      </>
                    )}
                    <span className="ml-auto font-semibold text-foreground lg:hidden">
                      {e.points} pts
                    </span>
                  </div>
                </div>

                {/* Task ID (desktop) */}
                <span className="hidden font-mono text-xs text-muted-foreground lg:block">
                  {e.readable_id}
                </span>

                {/* Points (desktop) */}
                <span className="hidden text-right text-sm font-semibold text-foreground lg:block">
                  {e.points}
                </span>

                {/* Credited On (desktop) */}
                <span className="hidden text-xs text-muted-foreground lg:block">
                  {new Date(e.credited_at).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function PointsSkeleton() {
  return (
    <div className="mt-8 space-y-8">
      <div className="flex items-center gap-2">
        <Skeleton className="h-9 w-36 rounded-md" />
        <Skeleton className="h-9 w-36 rounded-md" />
        <Skeleton className="h-9 w-16 rounded-md" />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-4">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="mt-3 h-8 w-12" />
            <Skeleton className="mt-1.5 h-3 w-16" />
          </div>
        ))}
      </div>
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  )
}
