"use client"

import { useEffect, useState } from "react"
import { Clock } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { getDeadlineCountdown } from "@/lib/task-utils"

export function DeadlineCountdown({
  deadline,
  status,
  className = "",
}: {
  deadline: string | null | undefined
  status: string
  className?: string
}) {
  const [info, setInfo] = useState(() => getDeadlineCountdown(deadline, status))

  useEffect(() => {
    setInfo(getDeadlineCountdown(deadline, status))
    const interval = setInterval(() => {
      setInfo(getDeadlineCountdown(deadline, status))
    }, 30000)

    return () => clearInterval(interval)
  }, [deadline, status])

  if (!info || !deadline) return null

  return (
    <span
      className={`inline-flex max-w-full items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-extrabold shadow-2xs transition-colors overflow-hidden ${info.badgeColor} ${className}`}
      title={info.formattedTime}
    >
      {info.isOverdue ? (
        <>
          <Badge
            variant="destructive"
            className="bg-red-600 text-white border-none text-[9px] px-1 py-0 font-extrabold uppercase shrink-0"
          >
            Overdue
          </Badge>
          <span className="font-extrabold truncate">
            {info.countdownText.replace(/^Overdue by /, "")}
          </span>
        </>
      ) : (
        <>
          <Clock className="h-3 w-3 shrink-0" />
          <span className="font-extrabold truncate">{info.countdownText}</span>
        </>
      )}
    </span>
  )
}
