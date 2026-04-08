import { Suspense } from "react"
import { getSession } from "@/lib/session"
import { redirect } from "next/navigation"
import { sql } from "@/lib/db"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { CalendarClock, Clock } from "lucide-react"
import { PageHeader } from "@/components/portal/page-header"
import { EmptyState } from "@/components/portal/empty-state"

type AttendanceRecord = {
  id: string
  date: string
  login_at: string
  logout_at: string | null
  duration_mins: number | null
  user_name: string
}

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ user?: string }>
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
          title="Attendance"
          description={
            isManager ? "Team attendance log." : "Your attendance history."
          }
        />
        <Suspense fallback={<AttendanceSkeleton />}>
          <AttendanceContent
            sessionId={session.id}
            isManager={isManager}
            searchParams={searchParams}
          />
        </Suspense>
      </div>
    </main>
  )
}

async function AttendanceContent({
  sessionId,
  isManager,
  searchParams,
}: {
  sessionId: string
  isManager: boolean
  searchParams: Promise<{ user?: string }>
}) {
  const params = await searchParams
  const filterUserId = isManager ? (params.user ?? null) : sessionId

  const records = filterUserId
    ? ((await sql`
        SELECT a.id, a.date, a.login_at, a.logout_at, a.duration_mins, u.name AS user_name
        FROM attendance a
        JOIN users u ON a.user_id = u.id
        WHERE a.user_id = ${filterUserId}
        ORDER BY a.date DESC
        LIMIT 60
      `) as AttendanceRecord[])
    : ((await sql`
        SELECT a.id, a.date, a.login_at, a.logout_at, a.duration_mins, u.name AS user_name
        FROM attendance a
        JOIN users u ON a.user_id = u.id
        ORDER BY a.date DESC, a.login_at DESC
        LIMIT 100
      `) as AttendanceRecord[])

  const designers = isManager
    ? ((await sql`SELECT id, name FROM users WHERE active = true ORDER BY name`) as {
        id: string
        name: string
      }[])
    : []

  return (
    <div className="mt-8 space-y-8">
      {/* Filter bar */}
      {isManager && (
        <form className="flex items-center gap-2">
          <NativeSelect name="user" defaultValue={filterUserId ?? ""}>
            <NativeSelectOption value="">All Members</NativeSelectOption>
            {designers.map((d) => (
              <NativeSelectOption key={d.id} value={d.id}>
                {d.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <Button type="submit" size="sm">
            Filter
          </Button>
        </form>
      )}

      {/* Content */}
      {records.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          description="No attendance records yet."
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
          {/* Desktop column headers */}
          <div
            className={`hidden items-center gap-4 border-b border-border bg-muted/30 px-4 py-2.5 text-xs font-medium text-muted-foreground lg:grid ${
              isManager
                ? "grid-cols-[140px_140px_100px_100px_100px_80px]"
                : "grid-cols-[160px_120px_120px_120px_80px]"
            }`}
          >
            {isManager && <span>Name</span>}
            <span>Date</span>
            <span>Clock In</span>
            <span>Clock Out</span>
            <span>Duration</span>
            <span>Status</span>
          </div>

          <div className="divide-y divide-border">
            {records.map((r) => (
              <AttendanceRow key={r.id} record={r} showName={isManager} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function formatDuration(mins: number | null) {
  if (!mins) return "—"
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

function AttendanceRow({
  record: r,
  showName,
}: {
  record: AttendanceRecord
  showName: boolean
}) {
  return (
    <div
      className={`group flex flex-col gap-2 px-4 py-3.5 transition-colors hover:bg-muted/40 lg:grid lg:items-center lg:gap-4 ${
        showName
          ? "lg:grid-cols-[140px_140px_100px_100px_100px_80px]"
          : "lg:grid-cols-[160px_120px_120px_120px_80px]"
      }`}
    >
      {/* Name (manager view) */}
      {showName && (
        <span className="text-sm font-medium text-foreground">
          {r.user_name}
        </span>
      )}

      {/* Date */}
      <div className="flex items-center gap-1.5">
        <span className="text-sm text-foreground lg:text-sm">
          {new Date(r.date).toLocaleDateString("en-IN", {
            weekday: "short",
            day: "numeric",
            month: "short",
          })}
        </span>
        {/* Mobile-only status */}
        <span className="ml-auto lg:hidden">
          {r.logout_at ? (
            <Badge variant="outline" className="text-[10px]">
              Done
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="border-emerald-500/20 bg-emerald-500/10 text-[10px] text-emerald-600 dark:text-emerald-400"
            >
              Active
            </Badge>
          )}
        </span>
      </div>

      {/* Clock In */}
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground lg:text-sm">
        <Clock className="h-3 w-3 lg:hidden" />
        <span>
          {new Date(r.login_at).toLocaleTimeString("en-IN", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
        <span className="lg:hidden">→</span>
        <span className="lg:hidden">
          {r.logout_at
            ? new Date(r.logout_at).toLocaleTimeString("en-IN", {
                hour: "2-digit",
                minute: "2-digit",
              })
            : "—"}
        </span>
        {r.duration_mins != null && (
          <span className="ml-auto text-xs font-medium text-foreground lg:hidden">
            {formatDuration(r.duration_mins)}
          </span>
        )}
      </div>

      {/* Clock Out (desktop) */}
      <span className="hidden text-sm text-muted-foreground lg:block">
        {r.logout_at
          ? new Date(r.logout_at).toLocaleTimeString("en-IN", {
              hour: "2-digit",
              minute: "2-digit",
            })
          : "—"}
      </span>

      {/* Duration (desktop) */}
      <span className="hidden text-sm text-foreground lg:block">
        {formatDuration(r.duration_mins)}
      </span>

      {/* Status (desktop) */}
      <div className="hidden lg:block">
        {r.logout_at ? (
          <Badge variant="outline" className="text-xs">
            Done
          </Badge>
        ) : (
          <Badge
            variant="outline"
            className="border-emerald-500/20 bg-emerald-500/10 text-xs text-emerald-600 dark:text-emerald-400"
          >
            Active
          </Badge>
        )}
      </div>
    </div>
  )
}

function AttendanceSkeleton() {
  return (
    <div className="mt-8 space-y-8">
      <div className="flex items-center gap-2">
        <Skeleton className="h-9 w-40 rounded-md" />
        <Skeleton className="h-9 w-16 rounded-md" />
      </div>
      <Skeleton className="h-80 w-full rounded-xl" />
    </div>
  )
}
