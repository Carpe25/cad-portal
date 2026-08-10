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
  high: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
  medium: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  low: "bg-secondary text-muted-foreground",
}

export const SPEED_COLORS: Record<string, string> = {
  U: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
  N: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
}

export const SPEED_LABELS: Record<string, string> = {
  U: "Speed: Urgent (U)",
  N: "Speed: Normal (N)",
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

/**
 * Safely parses any date string (YYYY-MM-DD, DD-MM-YYYY, or ISO string) into a Date object at 23:59:59.
 */
export function parseDeadlineDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null
  const trimmed = dateStr.trim()
  const parts = trimmed.split("-")
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      // YYYY-MM-DD
      return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10), 23, 59, 59)
    } else if (parts[2].length === 4) {
      // DD-MM-YYYY
      return new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10), 23, 59, 59)
    }
  }
  const parsed = new Date(trimmed)
  if (isNaN(parsed.getTime())) return null
  // Set end of day if only date was provided
  if (!trimmed.includes("T") && !trimmed.includes(":")) {
    parsed.setHours(23, 59, 59, 999)
  }
  return parsed
}

/**
 * Checks if an active task (assigned, in_progress, revision_requested) is past its deadline.
 */
export function isTaskOverdue(deadlineStr: string | null | undefined, status: string): boolean {
  if (!deadlineStr) return false
  const activeStatuses = ["assigned", "in_progress", "revision_requested"]
  if (!activeStatuses.includes(status)) return false

  const deadlineDate = parseDeadlineDate(deadlineStr)
  if (!deadlineDate) return false

  return new Date() > deadlineDate
}

/**
 * Checks if a submission was made after the task deadline.
 */
export function isSubmissionLate(submittedAtStr: string | null | undefined, deadlineStr: string | null | undefined): boolean {
  if (!submittedAtStr || !deadlineStr) return false
  const submittedDate = new Date(submittedAtStr)
  const deadlineDate = parseDeadlineDate(deadlineStr)
  if (isNaN(submittedDate.getTime()) || !deadlineDate) return false

  return submittedDate > deadlineDate
}

/**
 * Safely formats any date string (DD-MM-YYYY, YYYY-MM-DD, or ISO) to locale string without throwing RangeError.
 */
export function formatDateDisplay(
  dateStr: string | null | undefined,
  options: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }
): string {
  if (!dateStr) return "—"
  const dateObj = parseDeadlineDate(dateStr)
  if (!dateObj || isNaN(dateObj.getTime())) return String(dateStr)
  try {
    return dateObj.toLocaleDateString("en-IN", options)
  } catch (e) {
    return String(dateStr)
  }
}


