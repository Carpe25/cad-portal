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
 * Safely parses any date input (YYYY-MM-DD, DD-MM-YYYY, ISO string, or Date object) into a Date object.
 * Preserves exact time if ISO string/time is provided, or defaults to 23:59:59 if date-only string is provided.
 */
export function parseDeadlineDate(dateInput: any): Date | null {
  if (!dateInput) return null
  if (dateInput instanceof Date) {
    if (isNaN(dateInput.getTime())) return null
    return dateInput
  }
  const dateStr = String(dateInput).trim()
  if (!dateStr || dateStr === "null" || dateStr === "undefined") return null

  // Format: "DD-MM-YYYY HH:mm" or "YYYY-MM-DD HH:mm"
  if (dateStr.includes("-") && dateStr.includes(" ")) {
    const [dPart, tPart] = dateStr.split(" ")
    const dPieces = dPart.split("-")
    const tPieces = tPart ? tPart.split(":") : ["00", "00"]
    if (dPieces.length === 3) {
      let year = parseInt(dPieces[0], 10)
      let month = parseInt(dPieces[1], 10) - 1
      let day = parseInt(dPieces[2], 10)
      if (dPieces[2].length === 4) {
        // DD-MM-YYYY
        year = parseInt(dPieces[2], 10)
        day = parseInt(dPieces[0], 10)
      }
      const hours = parseInt(tPieces[0] || "0", 10)
      const mins = parseInt(tPieces[1] || "0", 10)
      const dt = new Date(year, month, day, hours, mins, 0)
      if (!isNaN(dt.getTime())) return dt
    }
  }

  // If it's an ISO timestamp or date-time string with time (contains "T" or ":")
  if (dateStr.includes("T") || dateStr.includes(":")) {
    const parsed = new Date(dateStr)
    if (!isNaN(parsed.getTime())) return parsed
  }

  // Pure date string without time (YYYY-MM-DD or DD-MM-YYYY)
  const parts = dateStr.split("-")
  if (parts.length === 3) {
    if (parts[0].length === 4 && parts[2].length <= 2) {
      // YYYY-MM-DD
      return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10), 23, 59, 59)
    } else if (parts[2].length === 4 && parts[0].length <= 2) {
      // DD-MM-YYYY
      return new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10), 23, 59, 59)
    }
  }
  const parsed = new Date(dateStr)
  if (isNaN(parsed.getTime())) return null
  parsed.setHours(23, 59, 59, 999)
  return parsed
}

/**
 * Checks if an active task (assigned, in_progress, revision_requested) is past its deadline.
 */
export function isTaskOverdue(deadlineInput: any, status: string): boolean {
  if (!deadlineInput) return false
  const activeStatuses = ["assigned", "in_progress", "revision_requested"]
  if (!activeStatuses.includes(status)) return false

  const deadlineDate = parseDeadlineDate(deadlineInput)
  if (!deadlineDate) return false

  return new Date() > deadlineDate
}

/**
 * Calculates live deadline countdown information for tasks.
 */
export type DeadlineCountdownResult = {
  isOverdue: boolean
  formattedTime: string
  countdownText: string
  badgeColor: string
}

export function getDeadlineCountdown(
  deadlineInput: any,
  status: string
): DeadlineCountdownResult | null {
  if (!deadlineInput) return null

  const activeStatuses = ["assigned", "in_progress", "revision_requested"]
  const isActive = activeStatuses.includes(status)

  const deadlineDate = parseDeadlineDate(deadlineInput)
  if (!deadlineDate) return null

  const now = new Date()
  const diffMs = deadlineDate.getTime() - now.getTime()

  const formattedTime = formatDateDisplay(deadlineInput, {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  })

  if (diffMs < 0 && isActive) {
    const absDiff = Math.abs(diffMs)
    const hours = Math.floor(absDiff / (1000 * 60 * 60))
    const minutes = Math.floor((absDiff % (1000 * 60 * 60)) / (1000 * 60))
    const days = Math.floor(hours / 24)
    const remHours = hours % 24

    let overdueText = "Overdue"
    if (days > 0) {
      overdueText = `Overdue by ${days}d ${remHours}h`
    } else if (hours > 0) {
      overdueText = `Overdue by ${hours}h ${minutes}m`
    } else if (minutes > 0) {
      overdueText = `Overdue by ${minutes}m`
    }

    return {
      isOverdue: true,
      formattedTime,
      countdownText: overdueText,
      badgeColor: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/40",
    }
  } else {
    const absDiff = Math.max(0, diffMs)
    const hours = Math.floor(absDiff / (1000 * 60 * 60))
    const minutes = Math.floor((absDiff % (1000 * 60 * 60)) / (1000 * 60))
    const days = Math.floor(hours / 24)
    const remHours = hours % 24

    let countdownText = ""
    if (days > 0) {
      countdownText = `${days}d ${remHours}h left`
    } else if (hours > 0) {
      countdownText = `${hours}h ${minutes}m left`
    } else if (minutes > 0) {
      countdownText = `${minutes}m left`
    } else {
      countdownText = "< 1m left"
    }

    let badgeColor = "bg-amber-500/15 text-amber-900 dark:text-amber-300 border-amber-500/40"
    if (diffMs < 3 * 3600 * 1000 && isActive) {
      badgeColor = "bg-orange-500/15 text-orange-800 dark:text-orange-300 border-orange-500/40"
    }

    return {
      isOverdue: false,
      formattedTime,
      countdownText: isActive ? countdownText : formattedTime,
      badgeColor,
    }
  }
}

/**
 * Checks if a submission was made after the task deadline.
 */
export function isSubmissionLate(submittedAtInput: any, deadlineInput: any): boolean {
  if (!submittedAtInput || !deadlineInput) return false
  const submittedDate = parseDeadlineDate(submittedAtInput)
  const deadlineDate = parseDeadlineDate(deadlineInput)
  if (!submittedDate || !deadlineDate) return false

  return submittedDate > deadlineDate
}

/**
 * Safely formats any date input (DD-MM-YYYY, YYYY-MM-DD, ISO, or Date object) to locale string without throwing RangeError.
 */
export function formatDateDisplay(
  dateInput: any,
  options: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }
): string {
  if (!dateInput) return "—"
  const dateObj = parseDeadlineDate(dateInput)
  if (!dateObj || isNaN(dateObj.getTime())) return String(dateInput)
  try {
    return dateObj.toLocaleDateString("en-IN", options)
  } catch (e) {
    return String(dateInput)
  }
}

/**
 * Safely formats any date & time input (ISO string, Date object, etc.) to locale string with date and time in Indian Standard Time.
 */
export function formatDateTimeDisplay(
  dateInput: any,
  options: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  }
): string {
  if (!dateInput) return "—"
  const dateObj = dateInput instanceof Date ? dateInput : new Date(dateInput)
  if (isNaN(dateObj.getTime())) {
    const parsed = parseDeadlineDate(dateInput)
    if (!parsed || isNaN(parsed.getTime())) return String(dateInput)
    return parsed.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", ...options })
  }
  try {
    return dateObj.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", ...options })
  } catch (e) {
    return String(dateInput)
  }
}

/**
 * Normalizes any deadline input string/date to a clean ISO 8601 string for PostgreSQL storage.
 */
export function normalizeDeadlineForDb(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null
  const trimmed = String(dateStr).trim()
  if (!trimmed || trimmed === "null" || trimmed === "undefined") return null
  const parsed = parseDeadlineDate(trimmed)
  if (!parsed || isNaN(parsed.getTime())) return null
  return parsed.toISOString()
}

/**
 * Normalizes any request date input string/date to YYYY-MM-DD for PostgreSQL DATE storage.
 */
export function normalizeRequestDateForDb(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null
  const trimmed = String(dateStr).trim()
  if (!trimmed || trimmed === "null" || trimmed === "undefined") return null
  const parsed = parseDeadlineDate(trimmed)
  if (!parsed || isNaN(parsed.getTime())) return null
  const year = parsed.getFullYear()
  const month = String(parsed.getMonth() + 1).padStart(2, "0")
  const day = String(parsed.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

/**
 * Checks if a version string represents Version 2 or higher (e.g. V2, V3, V4...).
 */
export function isVersionV2OrHigher(version?: string | null): boolean {
  if (!version) return false
  const cleaned = version.trim().toUpperCase()
  if (cleaned === "V1" || cleaned === "1" || cleaned === "V0" || cleaned === "V01") return false
  const match = cleaned.match(/^V?(\d+)/)
  if (match) {
    const num = parseInt(match[1], 10)
    return num >= 2
  }
  return cleaned !== "V1"
}






