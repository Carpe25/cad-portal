import Link from "next/link"
import {
  LayoutDashboard,
  ListTodo,
  PlusSquare,
  ShieldCheck,
  Users,
  BarChart2,
  Wallet,
  CalendarClock,
  LogOut,
  SplinePointer,
} from "lucide-react"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar"
import { ClockInButton } from "@/components/clock-in-button"
import { LogoutButton } from "@/components/logout-button"
import type { SessionUser } from "@/lib/session"
import { sql } from "@/lib/db"

type NavItem = {
  label: string
  href: string
  icon: React.ElementType
}

function getNavItems(roles: string[]): { group: string; items: NavItem[] }[] {
  const isManager = roles.includes("manager")
  const isQC = roles.includes("qc")

  if (isManager) {
    return [
      {
        group: "Overview",
        items: [{ label: "Dashboard", href: "/dashboard", icon: LayoutDashboard }],
      },
      {
        group: "Tasks",
        items: [
          { label: "All Tasks", href: "/tasks", icon: ListTodo },
          { label: "Create Task", href: "/tasks/new", icon: PlusSquare },
          { label: "QC Queue", href: "/qc-queue", icon: ShieldCheck },
        ],
      },
      {
        group: "Team",
        items: [{ label: "Members", href: "/team", icon: Users }],
      },
      {
        group: "Finance",
        items: [
          { label: "Points Log", href: "/points", icon: BarChart2 },
          { label: "Payouts", href: "/payouts", icon: Wallet },
        ],
      },
    ]
  }

  if (isQC) {
    return [
      {
        group: "Overview",
        items: [{ label: "Dashboard", href: "/dashboard", icon: LayoutDashboard }],
      },
      {
        group: "Tasks",
        items: [
          { label: "All Tasks", href: "/tasks", icon: ListTodo },
          { label: "Create Task", href: "/tasks/new", icon: PlusSquare },
          { label: "QC Queue", href: "/qc-queue", icon: ShieldCheck },
        ],
      },
      {
        group: "Earnings",
        items: [{ label: "Points Log", href: "/points", icon: BarChart2 }],
      },
    ]
  }

  // Designer
  return [
    {
      group: "Overview",
      items: [{ label: "Dashboard", href: "/dashboard", icon: LayoutDashboard }],
    },
    {
      group: "Work",
      items: [{ label: "My Tasks", href: "/tasks", icon: ListTodo }],
    },
    {
      group: "Earnings",
      items: [{ label: "Points Log", href: "/points", icon: BarChart2 }],
    },
  ]
}

function getRoleBadge(roles: string[]) {
  if (roles.includes("manager")) return { label: "Manager", color: "bg-primary/10 text-primary" }
  if (roles.includes("qc")) return { label: "QC", color: "bg-amber-500/10 text-amber-600 dark:text-amber-400" }
  return { label: "Designer", color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" }
}

export async function AppSidebar({ session }: { session: SessionUser }) {
  const navGroups = getNavItems(session.roles)
  const badge = getRoleBadge(session.roles)

  // Check if user is clocked in today
  const today = new Date().toISOString().split("T")[0]
  const rows = await sql`
    SELECT id, login_at, logout_at FROM attendance
    WHERE user_id = ${session.id} AND date = ${today}
    LIMIT 1
  `
  const todayAttendance = rows[0] as
    | { id: string; login_at: string; logout_at: string | null }
    | undefined
  const isClockedIn = !!todayAttendance && !todayAttendance.logout_at

  return (
    <Sidebar>
      {/* Brand */}
      <SidebarHeader className="px-4 py-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary">
            <SplinePointer strokeWidth={1.5} className="text-primary-foreground" size={20} />
          </div>
          <div>
            <p className="font-heading text-sm font-semibold leading-none">
              CAD Portal
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Carpe Diam
            </p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarSeparator />

      {/* Navigation */}
      <SidebarContent className="px-2 py-2">
        {navGroups.map((group) => (
          <SidebarGroup key={group.group}>
            <SidebarGroupLabel>{group.group}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild>
                      <Link href={item.href}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}

        {/* Attendance always at bottom of nav */}
        <SidebarGroup>
          <SidebarGroupLabel>System</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <Link href="/attendance">
                    <CalendarClock className="h-4 w-4" />
                    <span>Attendance</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Footer: Clock in + User */}
      <SidebarFooter className="px-3 py-3">
        <ClockInButton isClockedIn={isClockedIn} attendanceId={todayAttendance?.id} />

        <SidebarSeparator className="my-2" />

        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium leading-none">
              {session.name}
            </p>
            <span
              className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${badge.color}`}
            >
              {badge.label}
            </span>
          </div>
          <LogoutButton />
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
