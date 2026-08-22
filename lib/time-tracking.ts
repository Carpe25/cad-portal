import { sql, rows } from "@/lib/db"

export type TimeLogRole = "designer" | "qc"

export async function ensureTimeTrackingTables() {
  await sql`
    CREATE TABLE IF NOT EXISTS task_time_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      task_id UUID NOT NULL,
      user_id TEXT NOT NULL,
      role_type TEXT NOT NULL,
      started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      ended_at TIMESTAMPTZ,
      duration_secs INTEGER
    )
  `
}

export async function startTimeLog(
  taskId: string,
  userId: string,
  roleType: TimeLogRole
) {
  await ensureTimeTrackingTables()
  await sql`
    UPDATE task_time_logs
    SET ended_at = NOW(),
        duration_secs = GREATEST(1, EXTRACT(EPOCH FROM (NOW() - started_at))::INTEGER)
    WHERE task_id = ${taskId}
      AND user_id = ${userId}
      AND role_type = ${roleType}
      AND ended_at IS NULL
  `
  await sql`
    INSERT INTO task_time_logs (task_id, user_id, role_type, started_at)
    VALUES (${taskId}, ${userId}, ${roleType}, NOW())
  `
}

export async function endActiveTimeLogs(
  taskId: string,
  roleType: TimeLogRole,
  userId?: string
) {
  await ensureTimeTrackingTables()
  if (userId) {
    await sql`
      UPDATE task_time_logs
      SET ended_at = NOW(),
          duration_secs = GREATEST(1, EXTRACT(EPOCH FROM (NOW() - started_at))::INTEGER)
      WHERE task_id = ${taskId}
        AND user_id = ${userId}
        AND role_type = ${roleType}
        AND ended_at IS NULL
    `
  } else {
    await sql`
      UPDATE task_time_logs
      SET ended_at = NOW(),
          duration_secs = GREATEST(1, EXTRACT(EPOCH FROM (NOW() - started_at))::INTEGER)
      WHERE task_id = ${taskId}
        AND role_type = ${roleType}
        AND ended_at IS NULL
    `
  }
}

/** Record QC review time from submission until QC action, attributed to reviewer */
export async function recordQcReviewTime(
  taskId: string,
  reviewerId: string,
  startedAt: string | Date
) {
  await ensureTimeTrackingTables()
  const start =
    startedAt instanceof Date ? startedAt.toISOString() : String(startedAt)
  await sql`
    INSERT INTO task_time_logs (task_id, user_id, role_type, started_at, ended_at, duration_secs)
    VALUES (
      ${taskId},
      ${reviewerId},
      'qc',
      ${start}::timestamptz,
      NOW(),
      GREATEST(1, EXTRACT(EPOCH FROM (NOW() - ${start}::timestamptz))::INTEGER)
    )
  `
}

export type TaskTimeSummary = {
  user_id: string
  user_name: string
  role_type: TimeLogRole
  total_secs: number
}

export async function getTaskTimeSummaries(taskId: string): Promise<TaskTimeSummary[]> {
  await ensureTimeTrackingTables()
  return rows<TaskTimeSummary>(await sql`
    SELECT
      l.user_id,
      u.name AS user_name,
      l.role_type,
      COALESCE(
        SUM(
          CASE
            WHEN l.duration_secs IS NOT NULL THEN l.duration_secs
            WHEN l.ended_at IS NOT NULL THEN EXTRACT(EPOCH FROM (l.ended_at - l.started_at))::INTEGER
            ELSE EXTRACT(EPOCH FROM (NOW() - l.started_at))::INTEGER
          END
        ),
        0
      )::INTEGER AS total_secs
    FROM task_time_logs l
    LEFT JOIN users u ON u.id::text = l.user_id
    WHERE l.task_id = ${taskId}
    GROUP BY l.user_id, u.name, l.role_type
    ORDER BY l.role_type, u.name
  `)
}

export function formatDuration(totalSecs: number): string {
  if (totalSecs <= 0) return "—"
  const hours = Math.floor(totalSecs / 3600)
  const minutes = Math.floor((totalSecs % 3600) / 60)
  const seconds = totalSecs % 60
  if (hours > 0) return `${hours}h ${minutes}m`
  if (minutes > 0) return `${minutes}m ${seconds}s`
  return `${seconds}s`
}
