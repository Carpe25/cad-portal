import { Suspense } from "react"
import { getSession } from "@/lib/session"
import { redirect } from "next/navigation"
import { sql } from "@/lib/db"
import { AddMemberButton } from "./add-member-button"
import { EditMemberButton } from "./edit-member-button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/components/portal/page-header"

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

const ROLE_BADGE_COLORS: Record<string, string> = {
  manager: "border-primary/20 bg-primary/10 text-primary",
  qc: "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  designer:
    "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
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

  return (
    <main className="min-h-full">
      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <PageHeader
          roleLabel="Manager"
          title="Team"
          description="Manage your team members and their roles."
          action={<AddMemberButton />}
        />
        <Suspense fallback={<TeamSkeleton />}>
          <TeamContent />
        </Suspense>
      </div>
    </main>
  )
}

async function TeamContent() {
  const members = (await sql`
    SELECT id, name, email, roles, rate_per_point, experience_years, active, created_at
    FROM users
    ORDER BY created_at ASC
  `) as Member[]

  const active = members.filter((m) => m.active)
  const inactive = members.filter((m) => !m.active)

  return (
    <div className="mt-8 space-y-8">
      {/* Summary */}
      <p className="text-sm text-muted-foreground">
        {active.length} active member{active.length !== 1 ? "s" : ""}
        {inactive.length > 0 && `, ${inactive.length} inactive`}
      </p>

      {/* Members list */}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
        {/* Desktop column headers */}
        <div className="hidden items-center gap-4 border-b border-border bg-muted/30 px-4 py-2.5 text-xs font-medium text-muted-foreground lg:grid lg:grid-cols-[minmax(0,1fr)_180px_140px_100px_100px_80px_48px]">
          <span>Member</span>
          <span>Email</span>
          <span>Roles</span>
          <span>Rate / pt</span>
          <span>Experience</span>
          <span>Status</span>
          <span />
        </div>

        <div className="divide-y divide-border">
          {members.map((m) => (
            <MemberRow key={m.id} member={m} />
          ))}
        </div>
      </div>
    </div>
  )
}

function MemberRow({ member: m }: { member: Member }) {
  return (
    <div
      className={`group flex flex-col gap-3 px-4 py-3.5 transition-colors hover:bg-muted/40 lg:grid lg:grid-cols-[minmax(0,1fr)_180px_140px_100px_100px_80px_48px] lg:items-center lg:gap-4 ${
        !m.active ? "opacity-60 grayscale" : ""
      }`}
    >
      {/* Name + avatar */}
      <div className="flex items-center gap-3">
        <div
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${getAvatarColor(m.name)}`}
        >
          {getInitials(m.name)}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">
            {m.name}
          </p>
          <p className="truncate text-xs text-muted-foreground lg:hidden">
            {m.email}
          </p>
        </div>
        {/* Mobile: status + edit */}
        <div className="ml-auto flex items-center gap-2 lg:hidden">
          {m.active ? (
            <Badge
              variant="outline"
              className="border-emerald-500/20 bg-emerald-500/10 text-[10px] text-emerald-600 dark:text-emerald-400"
            >
              Active
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[10px]">
              Inactive
            </Badge>
          )}
          <EditMemberButton member={m} />
        </div>
      </div>

      {/* Mobile: roles + meta */}
      <div className="flex flex-wrap items-center gap-1.5 lg:hidden">
        {m.roles.map((r) => (
          <Badge
            key={r}
            variant="outline"
            className={`text-[10px] capitalize ${ROLE_BADGE_COLORS[r] ?? ""}`}
          >
            {r}
          </Badge>
        ))}
        <span className="ml-auto text-xs text-muted-foreground">
          ₹{Number(m.rate_per_point).toLocaleString("en-IN")}/pt ·{" "}
          {m.experience_years ?? 0}{" "}
          {(m.experience_years ?? 0) === 1 ? "yr" : "yrs"}
        </span>
      </div>

      {/* Email (desktop) */}
      <span className="hidden truncate text-sm text-muted-foreground lg:block">
        {m.email}
      </span>

      {/* Roles (desktop) */}
      <div className="hidden flex-wrap gap-1 lg:flex">
        {m.roles.map((r) => (
          <Badge
            key={r}
            variant="outline"
            className={`text-xs capitalize ${ROLE_BADGE_COLORS[r] ?? ""}`}
          >
            {r}
          </Badge>
        ))}
      </div>

      {/* Rate (desktop) */}
      <span className="hidden text-sm font-medium text-foreground lg:block">
        ₹{Number(m.rate_per_point).toLocaleString("en-IN")}/pt
      </span>

      {/* Experience (desktop) */}
      <span className="hidden text-sm text-muted-foreground lg:block">
        {m.experience_years ?? 0}{" "}
        {(m.experience_years ?? 0) === 1 ? "yr" : "yrs"}
      </span>

      {/* Status (desktop) */}
      <div className="hidden lg:block">
        {m.active ? (
          <Badge
            variant="outline"
            className="border-emerald-500/20 bg-emerald-500/10 text-xs text-emerald-600 dark:text-emerald-400"
          >
            Active
          </Badge>
        ) : (
          <Badge variant="outline" className="text-xs">
            Inactive
          </Badge>
        )}
      </div>

      {/* Edit (desktop) */}
      <div className="hidden lg:block">
        <EditMemberButton member={m} />
      </div>
    </div>
  )
}

function TeamSkeleton() {
  return (
    <div className="mt-8 space-y-8">
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-80 w-full rounded-xl" />
    </div>
  )
}
