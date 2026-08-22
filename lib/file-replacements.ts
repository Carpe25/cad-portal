import { sql, rows } from "@/lib/db"

export async function ensureFileReplacementTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS task_file_replacements (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      task_id UUID NOT NULL,
      file_key TEXT NOT NULL,
      old_filename TEXT,
      new_filename TEXT,
      replaced_by TEXT NOT NULL,
      replaced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
}

export type FileReplacementLog = {
  id: string
  file_key: string
  old_filename: string | null
  new_filename: string | null
  replaced_by: string
  replacer_name: string | null
  replaced_at: string
}

export async function logFileReplacement({
  taskId,
  fileKey,
  oldFilename,
  newFilename,
  replacedBy,
}: {
  taskId: string
  fileKey: string
  oldFilename: string
  newFilename: string
  replacedBy: string
}) {
  await ensureFileReplacementTable()
  await sql`
    INSERT INTO task_file_replacements (task_id, file_key, old_filename, new_filename, replaced_by)
    VALUES (${taskId}, ${fileKey}, ${oldFilename}, ${newFilename}, ${replacedBy})
  `
}

export async function getFileReplacementLogs(taskId: string): Promise<FileReplacementLog[]> {
  await ensureFileReplacementTable()
  return rows<FileReplacementLog>(await sql`
    SELECT
      r.id,
      r.file_key,
      r.old_filename,
      r.new_filename,
      r.replaced_by,
      u.name AS replacer_name,
      r.replaced_at
    FROM task_file_replacements r
    LEFT JOIN users u ON u.id::text = r.replaced_by
    WHERE r.task_id = ${taskId}
    ORDER BY r.replaced_at DESC
  `)
}
