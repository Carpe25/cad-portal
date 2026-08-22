import { sql } from "@/lib/db"

export type TaskUploadRow = {
  id: string
  assigned_to: string | null
  status: string
  cd_project_no: string | null
  customer_project_no: string | null
  sr_no: string | null
}

/** Resolve a task by UUID, readable_id, or slug (case-insensitive). */
export async function findTaskByIdentifier(
  identifier: string
): Promise<TaskUploadRow | null> {
  const cleanId = decodeURIComponent(identifier.trim())
  if (!cleanId) return null

  const rows = await sql`
    SELECT id, assigned_to, status, cd_project_no, customer_project_no, sr_no
    FROM tasks
    WHERE LOWER(id::text) = LOWER(${cleanId})
       OR LOWER(readable_id) = LOWER(${cleanId})
       OR REPLACE(id::text, '-', '') = LOWER(REPLACE(${cleanId}, '-', ''))
    LIMIT 1
  `

  if (!rows.length) return null
  const row = rows[0] as TaskUploadRow
  return {
    ...row,
    id: String(row.id),
    assigned_to: row.assigned_to ? String(row.assigned_to) : null,
  }
}

export function canUploadToTask(
  task: TaskUploadRow,
  session: { id: string; roles: string[] }
): boolean {
  const isManager = session.roles.includes("manager")
  const isQC = session.roles.includes("qc")
  const isDesigner = session.roles.includes("designer")
  const canWork = isDesigner || isQC
  const isAssigned = task.assigned_to !== null && task.assigned_to === session.id

  if (isManager || isQC) return true
  if (isAssigned) return true
  if (canWork && task.assigned_to === null) return true
  return false
}
