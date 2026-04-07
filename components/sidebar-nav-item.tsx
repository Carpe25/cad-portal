"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { SidebarMenuButton } from "@/components/ui/sidebar"

type Props = {
  href: string
  icon: React.ReactNode
  label: string
}

export function SidebarNavItem({ href, icon, label }: Props) {
  const pathname = usePathname()
  const isActive =
    pathname === href ||
    (href !== "/dashboard" && pathname.startsWith(href + "/"))

  return (
    <SidebarMenuButton asChild isActive={isActive}>
      <Link href={href}>
        {icon}
        <span>{label}</span>
      </Link>
    </SidebarMenuButton>
  )
}
