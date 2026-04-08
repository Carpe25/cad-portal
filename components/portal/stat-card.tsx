import type { LucideIcon } from "lucide-react"

export function StatCard({
  label,
  value,
  note,
  icon: Icon,
  accent,
}: {
  label: string
  value: string | number
  note?: string
  icon: LucideIcon
  accent: string
}) {
  return (
    <div className="group relative rounded-xl border border-border bg-card p-4 shadow-xs transition-shadow hover:shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <Icon className={`h-3.5 w-3.5 shrink-0 ${accent}`} />
      </div>
      <p className="mt-2.5 text-3xl font-bold tracking-tight text-foreground">
        {value}
      </p>
      {note && <p className="mt-0.5 text-xs text-muted-foreground">{note}</p>}
    </div>
  )
}
