import { Suspense } from "react"
import { getSession } from "@/lib/session"
import { redirect } from "next/navigation"
import { sql } from "@/lib/db"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { CalendarClock, Wallet } from "lucide-react"
import { PageHeader } from "@/components/portal/page-header"
import { StatCard } from "@/components/portal/stat-card"

type PayoutRow = {
  designer_id: string
  designer_name: string
  total_points: number
  rate_per_point: number
  total_inr: number
}

export default async function PayoutsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>
}) {
  const session = await getSession()
  if (!session || !session.roles.includes("manager")) redirect("/dashboard")

  return (
    <main className="min-h-full">
      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <PageHeader
          roleLabel="Manager"
          title="Payouts"
          description="Month-end payout summary — points x rate per point."
        />
        <Suspense fallback={<PayoutsSkeleton />}>
          <PayoutsContent searchParams={searchParams} />
        </Suspense>
      </div>
    </main>
  )
}

async function PayoutsContent({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>
}) {
  const params = await searchParams
  const month = params.month ?? new Date().toISOString().slice(0, 7)

  const rows = (await sql`
    SELECT
      u.id AS designer_id,
      u.name AS designer_name,
      COALESCE(SUM(pl.points), 0) AS total_points,
      u.rate_per_point,
      COALESCE(SUM(pl.points), 0) * u.rate_per_point AS total_inr
    FROM users u
    LEFT JOIN points_log pl ON pl.user_id = u.id AND pl.month = ${month}
    WHERE u.active = true AND u.roles @> ARRAY['designer']::text[]
    GROUP BY u.id, u.name, u.rate_per_point
    ORDER BY total_points DESC
  `) as PayoutRow[]

  const grandTotal = rows.reduce((sum, r) => sum + Number(r.total_inr), 0)
  const totalPoints = rows.reduce((sum, r) => sum + Number(r.total_points), 0)

  return (
    <div className="mt-8 space-y-8">
      {/* Filter bar */}
      <form className="flex items-center gap-2">
        <Input
          type="month"
          name="month"
          defaultValue={month}
          className="w-auto"
        />
        <Button type="submit" size="sm">
          View
        </Button>
      </form>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard
          label="Month"
          value={month}
          note="Selected period"
          icon={CalendarClock}
          accent="text-muted-foreground"
        />
        <StatCard
          label="Total Payout"
          value={`₹${grandTotal.toLocaleString("en-IN")}`}
          note={`${totalPoints} total points`}
          icon={Wallet}
          accent="text-primary"
        />
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
        {/* Desktop column headers */}
        <div className="hidden items-center gap-4 border-b border-border bg-muted/30 px-4 py-2.5 text-xs font-medium text-muted-foreground lg:grid lg:grid-cols-[minmax(0,1fr)_100px_100px_120px]">
          <span>Designer</span>
          <span className="text-right">Points</span>
          <span className="text-right">Rate/pt</span>
          <span className="text-right">Payout</span>
        </div>

        <div className="divide-y divide-border">
          {rows.map((r) => (
            <div
              key={r.designer_id}
              className="flex items-start gap-3 px-4 py-3.5 transition-colors hover:bg-muted/40 lg:grid lg:grid-cols-[minmax(0,1fr)_100px_100px_120px] lg:items-center lg:gap-4"
            >
              {/* Name + mobile meta */}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">
                  {r.designer_name}
                </p>
                <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground lg:hidden">
                  <span>{Number(r.total_points)} pts</span>
                  <span>·</span>
                  <span>
                    ₹{Number(r.rate_per_point).toLocaleString("en-IN")}/pt
                  </span>
                  <span className="ml-auto font-semibold text-foreground">
                    ₹{Number(r.total_inr).toLocaleString("en-IN")}
                  </span>
                </div>
              </div>

              {/* Points (desktop) */}
              <span className="hidden text-right text-sm text-foreground lg:block">
                {Number(r.total_points)}
              </span>

              {/* Rate (desktop) */}
              <span className="hidden text-right text-sm text-muted-foreground lg:block">
                ₹{Number(r.rate_per_point).toLocaleString("en-IN")}
              </span>

              {/* Payout (desktop) */}
              <span className="hidden text-right text-sm font-semibold text-foreground lg:block">
                ₹{Number(r.total_inr).toLocaleString("en-IN")}
              </span>
            </div>
          ))}

          {/* Total row */}
          <div className="flex items-center gap-4 bg-muted/30 px-4 py-3.5 lg:grid lg:grid-cols-[minmax(0,1fr)_100px_100px_120px]">
            <span className="text-sm font-semibold text-foreground">Total</span>
            <span className="hidden lg:block" />
            <span className="hidden lg:block" />
            <span className="ml-auto text-sm font-bold text-foreground lg:ml-0 lg:text-right">
              ₹{grandTotal.toLocaleString("en-IN")}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

function PayoutsSkeleton() {
  return (
    <div className="mt-8 space-y-8">
      <div className="flex items-center gap-2">
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
