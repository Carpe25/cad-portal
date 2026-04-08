import type { ReactNode } from "react"

export function PageHeader({
  roleLabel,
  title,
  description,
  action,
}: {
  roleLabel?: string
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-1">
        {roleLabel && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium tracking-widest text-muted-foreground uppercase">
              {roleLabel}
            </span>
          </div>
        )}
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          {title}
        </h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {action && <div className="self-start sm:self-auto">{action}</div>}
    </div>
  )
}
