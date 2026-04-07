import { getSession } from "@/lib/session"
import { redirect } from "next/navigation"
import { sql } from "@/lib/db"
import { AddMemberButton } from "./add-member-button"
import { EditMemberButton } from "./edit-member-button"

type Member = {
  id: string
  name: string
  email: string
  roles: string[]
  rate_per_point: number
  experience_years: number
  active: boolean
  created_at: string
}

const ROLE_COLORS: Record<string, string> = {
  manager: "bg-primary/10 text-primary",
  qc: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  designer: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
}

export default async function TeamPage() {
  const session = await getSession()
  if (!session || !session.roles.includes("manager")) redirect("/dashboard")

  const members = (await sql`
    SELECT id, name, email, roles, rate_per_point, experience_years, active, created_at
    FROM users
    ORDER BY created_at ASC
  `) as Member[]

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-heading text-xl font-semibold">Team</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage members, roles, and payout rates.
          </p>
        </div>
        <AddMemberButton />
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Name</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Email</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Roles</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Rate / pt</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Experience</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground"></th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr
                key={m.id}
                className="border-b border-border/60 last:border-0 hover:bg-muted/30"
              >
                <td className="px-4 py-3 font-medium">{m.name}</td>
                <td className="px-4 py-3 text-muted-foreground">{m.email}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {m.roles.map((r) => (
                      <span
                        key={r}
                        className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${ROLE_COLORS[r] ?? "bg-secondary text-secondary-foreground"}`}
                      >
                        {r}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3 font-medium">
                  ₹{Number(m.rate_per_point).toLocaleString("en-IN")}/pt
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {m.experience_years ?? 0} {(m.experience_years ?? 0) === 1 ? "yr" : "yrs"}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${m.active ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-secondary text-muted-foreground"}`}
                  >
                    {m.active ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <EditMemberButton member={m} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
