import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { AppSidebar } from "@/components/app-sidebar"
import { NavBreadcrumb } from "@/components/nav-breadcrumb"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { ThemeToggle } from "@/components/theme-toggle"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getSession()
  if (!session) redirect("/login")

  const initials = session.name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase()

  return (
    <SidebarProvider>
      <AppSidebar session={session} />
      <SidebarInset>
        <header className="flex h-13 shrink-0 items-center gap-2 border-b border-border bg-card/60 px-4 backdrop-blur-sm justify-between">
          <div className="flex h-13 shrink-0 items-center gap-2">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-full" />
            <NavBreadcrumb />
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            {/* <Avatar className="h-8 w-8 shrink-0">
              <AvatarFallback className="bg-primary/15 text-xs font-semibold text-primary">
                {initials}
              </AvatarFallback>
            </Avatar> */}
          </div>
        </header>
        <div className="flex flex-1 flex-col">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  )
}
