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
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { TooltipProvider } from "@/components/ui/tooltip"
import { ClockInButton } from "@/components/clock-in-button"
import { LogoutButton } from "@/components/logout-button"
import { SidebarNavItem } from "@/components/sidebar-nav-item"
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
        items: [
          { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
        ],
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
        items: [
          { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
        ],
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

  return [
    {
      group: "Overview",
      items: [
        { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      ],
    },
    {
      group: "Work",
      items: [{ label: "Tasks", href: "/tasks", icon: ListTodo }],
    },
    {
      group: "Earnings",
      items: [{ label: "Points Log", href: "/points", icon: BarChart2 }],
    },
  ]
}

function getRoleBadge(roles: string[]) {
  if (roles.includes("manager"))
    return { label: "Manager", color: "bg-primary/15 text-primary" }
  if (roles.includes("qc"))
    return {
      label: "QC",
      color: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    }
  return {
    label: "Designer",
    color: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  }
}

export async function AppSidebar({ session }: { session: SessionUser }) {
  const navGroups = getNavItems(session.roles)
  const badge = getRoleBadge(session.roles)

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

  const initials = session.name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase()

  return (
    <Sidebar>
      {/* Brand */}
      <SidebarHeader className="px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary shadow-sm">
            <SplinePointer
              strokeWidth={1.5}
              className="text-primary-foreground"
              size={18}
            />
          </div>
          <div className="min-w-0">
            <p className="truncate font-heading text-sm leading-none font-semibold">
              CAD Portal
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">Carpe Diam</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarSeparator className="mx-auto" />

      {/* Navigation */}
      <SidebarContent className="px-2 py-2">
        {navGroups.map((group) => (
          <SidebarGroup key={group.group}>
            <SidebarGroupLabel>{group.group}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarNavItem
                      href={item.href}
                      icon={<item.icon className="h-4 w-4" />}
                      label={item.label}
                    />
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}

        <SidebarGroup>
          <SidebarGroupLabel>System</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarNavItem
                  href="/attendance"
                  icon={<CalendarClock className="h-4 w-4" />}
                  label="Attendance"
                />
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Footer */}
      <SidebarFooter className="px-3 py-3">
        <ClockInButton
          isClockedIn={isClockedIn}
          attendanceId={todayAttendance?.id}
        />

        <SidebarSeparator className="mx-auto" />

        <TooltipProvider delayDuration={300}>
          <div className="flex items-center gap-2.5">
            <Avatar className="h-8 w-8 shrink-0">
              <AvatarFallback className="bg-primary/15 text-xs font-semibold text-primary">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm leading-none font-medium">
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
        </TooltipProvider>
      </SidebarFooter>
    </Sidebar>
  )
}
