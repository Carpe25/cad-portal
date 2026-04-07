import { getSession } from "@/lib/session"
import { redirect } from "next/navigation"
import { sql } from "@/lib/db"

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

  const params = await searchParams
  const isManager = session.roles.includes("manager")
  const filterUserId = isManager ? (params.user ?? null) : session.id

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
    ? ((await sql`SELECT id, name FROM users WHERE active = true ORDER BY name`) as { id: string; name: string }[])
    : []

  function formatDuration(mins: number | null) {
    if (!mins) return "—"
    const h = Math.floor(mins / 60)
    const m = mins % 60
    return h > 0 ? `${h}h ${m}m` : `${m}m`
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-xl font-semibold">Attendance</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isManager ? "Team attendance log." : "Your attendance history."}
          </p>
        </div>

        {isManager && (
          <form className="flex gap-2">
            <select
              name="user"
              defaultValue={filterUserId ?? ""}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">All Members</option>
              {designers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Filter
            </button>
          </form>
        )}
      </div>

      {records.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card py-16 text-center">
          <p className="text-sm text-muted-foreground">No attendance records yet.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                {isManager && (
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Name</th>
                )}
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Date</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Clock In</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Clock Out</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Duration</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id} className="border-b border-border/60 last:border-0">
                  {isManager && (
                    <td className="px-4 py-3 font-medium">{r.user_name}</td>
                  )}
                  <td className="px-4 py-3">
                    {new Date(r.date).toLocaleDateString("en-IN", {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(r.login_at).toLocaleTimeString("en-IN", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {r.logout_at
                      ? new Date(r.logout_at).toLocaleTimeString("en-IN", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "—"}
                  </td>
                  <td className="px-4 py-3">{formatDuration(r.duration_mins)}</td>
                  <td className="px-4 py-3">
                    {r.logout_at ? (
                      <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
                        Done
                      </span>
                    ) : (
                      <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-600 dark:text-emerald-400">
                        Active
                      </span>
                    )}
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
