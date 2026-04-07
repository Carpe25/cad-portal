"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { LogOut } from "lucide-react"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

export function LogoutButton() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function handleLogout() {
    startTransition(async () => {
      await fetch("/api/auth/logout", { method: "POST" })
      router.push("/login")
    })
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={handleLogout}
          disabled={isPending}
          aria-label="Sign out"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top">Sign out</TooltipContent>
    </Tooltip>
  )
}
