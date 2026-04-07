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

function getInitials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase()
}

function getAvatarColor(name: string) {
  const colors = [
    "bg-primary/15 text-primary",
    "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
    "bg-amber-500/15 text-amber-700 dark:text-amber-400",
    "bg-rose-500/15 text-rose-700 dark:text-rose-400",
    "bg-violet-500/15 text-violet-700 dark:text-violet-400",
    "bg-cyan-500/15 text-cyan-700 dark:text-cyan-400",
  ]
  let hash = 0
  for (const c of name) hash = (hash * 31 + c.charCodeAt(0)) & 0xffffff
  return colors[Math.abs(hash) % colors.length]
}

export default async function TeamPage() {
  const session = await getSession()
  if (!session || !session.roles.includes("manager")) redirect("/dashboard")

  const members = (await sql`
    SELECT id, name, email, roles, rate_per_point, experience_years, active, created_at
    FROM users
    ORDER BY created_at ASC
  `) as Member[]

  const active = members.filter((m) => m.active)
  const inactive = members.filter((m) => !m.active)

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-heading text-xl font-semibold">Team</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {active.length} active member{active.length !== 1 ? "s" : ""}
            {inactive.length > 0 && `, ${inactive.length} inactive`}
          </p>
        </div>
        <AddMemberButton />
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                Member
              </th>
              <th className="hidden px-4 py-3 text-left text-xs font-medium text-muted-foreground sm:table-cell">
                Email
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                Roles
              </th>
              <th className="hidden px-4 py-3 text-left text-xs font-medium text-muted-foreground md:table-cell">
                Rate / pt
              </th>
              <th className="hidden px-4 py-3 text-left text-xs font-medium text-muted-foreground lg:table-cell">
                Experience
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                Status
              </th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr
                key={m.id}
                className="border-b border-border/60 last:border-0 hover:bg-muted/30"
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${getAvatarColor(m.name)}`}
                    >
                      {getInitials(m.name)}
                    </div>
                    <span className="font-medium">{m.name}</span>
                  </div>
                </td>
                <td className="hidden px-4 py-3 text-muted-foreground sm:table-cell">
                  {m.email}
                </td>
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
                <td className="hidden px-4 py-3 font-medium md:table-cell">
                  ₹{Number(m.rate_per_point).toLocaleString("en-IN")}/pt
                </td>
                <td className="hidden px-4 py-3 text-muted-foreground lg:table-cell">
                  {m.experience_years ?? 0}{" "}
                  {(m.experience_years ?? 0) === 1 ? "yr" : "yrs"}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      m.active
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        : "bg-secondary text-muted-foreground"
                    }`}
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
