import { getSession } from "@/lib/session"
import { redirect } from "next/navigation"
import { sql } from "@/lib/db"

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

  return (
    <div className="p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-xl font-semibold">Payouts</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Month-end payout summary — points × rate per point.
          </p>
        </div>

        <form className="flex gap-2">
          <input
            type="month"
            name="month"
            defaultValue={month}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            type="submit"
            className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            View
          </button>
        </form>
      </div>

      {/* Grand total */}
      <div className="mb-4 inline-flex items-center gap-6 rounded-lg border border-border bg-card px-5 py-3">
        <div>
          <p className="text-xs text-muted-foreground">Month</p>
          <p className="font-medium">{month}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Total Payout</p>
          <p className="font-heading text-2xl font-semibold">
            ₹{grandTotal.toLocaleString("en-IN")}
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Designer</th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">Points Earned</th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">Rate/pt</th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">Payout</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.designer_id} className="border-b border-border/60 last:border-0">
                <td className="px-4 py-3 font-medium">{r.designer_name}</td>
                <td className="px-4 py-3 text-right">{Number(r.total_points)}</td>
                <td className="px-4 py-3 text-right text-muted-foreground">
                  ₹{Number(r.rate_per_point).toLocaleString("en-IN")}
                </td>
                <td className="px-4 py-3 text-right font-semibold">
                  ₹{Number(r.total_inr).toLocaleString("en-IN")}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-border bg-muted/40">
              <td className="px-4 py-3 font-semibold" colSpan={3}>Total</td>
              <td className="px-4 py-3 text-right font-bold">
                ₹{grandTotal.toLocaleString("en-IN")}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
