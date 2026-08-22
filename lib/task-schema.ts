import { sql } from "@/lib/db"

const TASK_STATUSES = [
  "assigned",
  "in_progress",
  "in_qc_review",
  "revision_requested",
  "ready_for_client",
  "client_ready",
  "closed",
] as const

/**
 * Neon / older DBs may have tasks_status_check without ready_for_client.
 * Drop and recreate so QC approve → ready_for_client works.
 */
export async function ensureTaskStatusConstraint() {
  await sql`ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_status_check`
  await sql`
    ALTER TABLE tasks ADD CONSTRAINT tasks_status_check
    CHECK (
      status IN (
        'assigned',
        'in_progress',
        'in_qc_review',
        'revision_requested',
        'ready_for_client',
        'client_ready',
        'closed'
      )
    )
  `
}

export { TASK_STATUSES }
