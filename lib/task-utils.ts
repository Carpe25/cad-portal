export const STATUS_LABELS: Record<string, string> = {
  assigned: "Assigned",
  in_progress: "In Progress",
  in_qc_review: "In QC Review",
  revision_requested: "Revision",
  client_ready: "Client Ready",
  closed: "Closed",
}

export const STATUS_LABELS_FULL: Record<string, string> = {
  ...STATUS_LABELS,
  revision_requested: "Revision Requested",
}

export const STATUS_COLORS: Record<string, string> = {
  assigned: "bg-secondary text-secondary-foreground",
  in_progress: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  in_qc_review: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  revision_requested: "bg-destructive/10 text-destructive",
  client_ready: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  closed: "bg-secondary text-muted-foreground",
}

export const PRIORITY_COLORS: Record<string, string> = {
  high: "bg-red-500/10 text-red-600 dark:text-red-400",
  medium: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  low: "bg-secondary text-muted-foreground",
}

export const LABEL_COLORS: Record<string, string> = {
  green: "bg-emerald-600/15 text-emerald-700 dark:text-emerald-400",
  yellow: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  orange: "bg-orange-500/15 text-orange-700 dark:text-orange-400",
  red: "bg-red-500/15 text-red-700 dark:text-red-400",
  purple: "bg-violet-500/15 text-violet-700 dark:text-violet-400",
  blue: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  sky: "bg-sky-500/15 text-sky-700 dark:text-sky-400",
  lime: "bg-lime-500/15 text-lime-700 dark:text-lime-400",
  pink: "bg-pink-500/15 text-pink-700 dark:text-pink-400",
  black: "bg-zinc-800/15 text-zinc-700 dark:text-zinc-300",
}

export function labelBadgeClass(color: string) {
  return LABEL_COLORS[color] ?? "bg-muted text-muted-foreground"
}
