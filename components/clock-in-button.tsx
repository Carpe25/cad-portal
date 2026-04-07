"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { LogIn, LogOut } from "lucide-react"
import { clockIn, clockOut } from "@/app/(portal)/attendance/actions"
import { cn } from "@/lib/utils"

export function ClockInButton({
  isClockedIn,
  attendanceId,
}: {
  isClockedIn: boolean
  attendanceId?: string
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function handleClick() {
    startTransition(async () => {
      if (isClockedIn && attendanceId) {
        await clockOut(attendanceId)
      } else {
        await clockIn()
      }
      router.refresh()
    })
  }

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      className={cn(
        "flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        isClockedIn
          ? "bg-destructive/10 text-destructive hover:bg-destructive/20"
          : "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 dark:text-emerald-400",
        "disabled:opacity-50"
      )}
    >
      {isClockedIn ? (
        <>
          <LogOut className="h-4 w-4" />
          {isPending ? "Clocking out…" : "Clock Out"}
        </>
      ) : (
        <>
          <LogIn className="h-4 w-4" />
          {isPending ? "Clocking in…" : "Clock In"}
        </>
      )}
    </button>
  )
}
