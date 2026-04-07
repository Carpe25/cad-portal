import { getSession } from "@/lib/session"
import { redirect } from "next/navigation"
import { sql } from "@/lib/db"

type PointEntry = {
  id: string
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

  const params = await searchParams
  const isManager = session.roles.includes("manager")
  const month = params.month ?? new Date().toISOString().slice(0, 7)
  const filterUserId = isManager ? (params.user ?? null) : session.id

  const entries = filterUserId
    ? ((await sql`
        SELECT pl.id, t.title AS task_title, t.readable_id, pl.points,
               pl.credited_at, pl.month, u.name AS designer_name
        FROM points_log pl
        JOIN tasks t ON pl.task_id = t.id
        JOIN users u ON pl.user_id = u.id
        WHERE pl.user_id = ${filterUserId} AND pl.month = ${month}
        ORDER BY pl.credited_at DESC
      `) as PointEntry[])
    : ((await sql`
        SELECT pl.id, t.title AS task_title, t.readable_id, pl.points,
               pl.credited_at, pl.month, u.name AS designer_name
        FROM points_log pl
        JOIN tasks t ON pl.task_id = t.id
        JOIN users u ON pl.user_id = u.id
        WHERE pl.month = ${month}
        ORDER BY pl.credited_at DESC
      `) as PointEntry[])

  const total = entries.reduce((sum, e) => sum + e.points, 0)

  const designers = isManager
    ? ((await sql`SELECT id, name FROM users WHERE roles @> ARRAY['designer']::text[] AND active = true ORDER BY name`) as { id: string; name: string }[])
    : []

  return (
    <div className="p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-xl font-semibold">Points Log</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isManager ? "All designer earnings." : "Your earned points."}
          </p>
        </div>

        {/* Filters */}
        <form className="flex gap-2">
          <input
            type="month"
            name="month"
            defaultValue={month}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {isManager && (
            <select
              name="user"
              defaultValue={filterUserId ?? ""}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">All Designers</option>
              {designers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          )}
          <button
            type="submit"
            className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Filter
          </button>
        </form>
      </div>

      {/* Summary */}
      <div className="mb-4 flex items-center gap-4">
        <div className="rounded-lg border border-border bg-card px-4 py-2">
          <p className="text-xs text-muted-foreground">Total Points</p>
          <p className="font-heading text-2xl font-semibold">{total}</p>
        </div>
        <div className="rounded-lg border border-border bg-card px-4 py-2">
          <p className="text-xs text-muted-foreground">Entries</p>
          <p className="font-heading text-2xl font-semibold">{entries.length}</p>
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card py-16 text-center">
          <p className="text-sm text-muted-foreground">
            No points earned in {month}.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                {isManager && (
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Designer</th>
                )}
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Task</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Task ID</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Points</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Credited On</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-b border-border/60 last:border-0">
                  {isManager && (
                    <td className="px-4 py-3 font-medium">{e.designer_name}</td>
                  )}
                  <td className="px-4 py-3">{e.task_title}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{e.readable_id}</td>
                  <td className="px-4 py-3 text-right font-semibold">{e.points}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(e.credited_at).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
