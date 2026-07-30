"use server"

import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { sql } from "@/lib/db"
import { getSession } from "@/lib/session"

export async function assignToMeAction(taskId: string) {
  const session = await getSession()
  if (!session) return { error: "Unauthorized" }
  const canWork =
    session.roles.includes("designer") || session.roles.includes("qc")
  if (!canWork) return { error: "Unauthorized" }

  // Only allow claiming if the task is unassigned or pre-assigned to this user
  const rows = await sql`
    SELECT assigned_to FROM tasks WHERE id = ${taskId} AND status = 'assigned'
  `
  if (rows.length === 0) return { error: "Task is not available" }

  const task = rows[0] as { assigned_to: string | null }
  if (task.assigned_to !== null && task.assigned_to !== session.id) {
    return { error: "This task is assigned to another designer" }
  }

  await sql`
    UPDATE tasks
    SET assigned_to = ${session.id}, status = 'in_progress'
    WHERE id = ${taskId} AND status = 'assigned'
      AND (assigned_to IS NULL OR assigned_to = ${session.id})
  `
  revalidatePath(`/tasks/${taskId}`)
  revalidatePath("/tasks")
}

export async function submitForQCAction(
  taskId: string,
  driveLink?: string,
  designerNotes?: string,
  folderPath?: string
) {
  const session = await getSession()
  if (!session) return { error: "Unauthorized" }

  const cleanFolderPath = folderPath ? folderPath.trim() : null
  const link = driveLink && driveLink.trim() ? driveLink.trim() : (cleanFolderPath || "")

  // Ensure columns exist
  await sql`ALTER TABLE submissions ADD COLUMN IF NOT EXISTS designer_notes TEXT`
  await sql`ALTER TABLE submissions ADD COLUMN IF NOT EXISTS folder_path TEXT`

  // Count existing submissions to determine version number
  const countRows = await sql`
    SELECT COUNT(*) FROM submissions WHERE task_id = ${taskId}
  `
  const count = Number((countRows[0] as { count: string | number }).count)
  const version = `V${count + 1}`

  await sql`
    INSERT INTO submissions (task_id, version, drive_link, submitted_by, outcome, designer_notes, folder_path)
    VALUES (${taskId}, ${version}, ${link}, ${session.id}, 'pending', ${designerNotes ? designerNotes.trim() : null}, ${cleanFolderPath})
  `

  await sql`
    UPDATE tasks SET status = 'in_qc_review' WHERE id = ${taskId}
  `

  revalidatePath(`/tasks/${taskId}`)
  revalidatePath("/tasks")
  revalidatePath("/qc-queue")
}

export async function submitForQCWithFilesAction(formData: FormData) {
  const session = await getSession()
  if (!session) return { error: "Unauthorized" }

  const taskId = formData.get("taskId") as string
  let driveLink = (formData.get("driveLink") as string) || ""

  if (!taskId) return { error: "Task ID is required" }

  const taskRows = await sql`SELECT drive_folder_link FROM tasks WHERE id = ${taskId}`
  if (!taskRows.length) return { error: "Task not found" }

  const taskDriveFolderLink = taskRows[0].drive_folder_link as string | null
  const files = formData.getAll("files") as File[]
  const relativePaths = formData.getAll("relativePaths") as string[]

  if (taskDriveFolderLink) {
    const { extractDriveFolderId, uploadFilesToDriveFolder } = await import("@/lib/drive")
    const folderId = extractDriveFolderId(taskDriveFolderLink)

    if (folderId && files.length > 0 && files[0] && files[0].size > 0) {
      try {
        const fileBuffers = await Promise.all(
          files.map(async (file, index) => {
            const arrayBuffer = await file.arrayBuffer()
            return {
              name: file.name,
              relativePath: relativePaths[index] || file.name,
              mimeType: file.type || "application/octet-stream",
              buffer: Buffer.from(arrayBuffer),
            }
          })
        )
        await uploadFilesToDriveFolder(folderId, fileBuffers)
      } catch (uploadError: any) {
        console.error("Error uploading CAD files to Google Drive:", uploadError)
        return { error: uploadError.message || "Failed to upload files to Google Drive." }
      }
    }
    driveLink = taskDriveFolderLink
  }

  if (!driveLink.trim()) {
    return { error: "Drive link or CAD files are required for submission." }
  }

  const countRows = await sql`
    SELECT COUNT(*) FROM submissions WHERE task_id = ${taskId}
  `
  const count = Number((countRows[0] as { count: string | number }).count)
  const version = `V${count + 1}`

  await sql`
    INSERT INTO submissions (task_id, version, drive_link, submitted_by, outcome)
    VALUES (${taskId}, ${version}, ${driveLink.trim()}, ${session.id}, 'pending')
  `

  await sql`
    UPDATE tasks SET status = 'in_qc_review' WHERE id = ${taskId}
  `

  revalidatePath(`/tasks/${taskId}`)
  revalidatePath("/tasks")
}


export async function approveSubmissionAction(
  taskId: string,
  submissionId: string
) {
  const session = await getSession()
  if (
    !session ||
    (!session.roles.includes("qc") && !session.roles.includes("manager"))
  ) {
    return { error: "Unauthorized" }
  }

  // Get task info for points
  const taskRows = await sql`
    SELECT points, assigned_to FROM tasks WHERE id = ${taskId}
  `
  const task = taskRows[0] as { points: number; assigned_to: string }

  // Update submission
  await sql`
    UPDATE submissions
    SET outcome = 'approved', reviewed_by = ${session.id}
    WHERE id = ${submissionId}
  `

  // Update task status
  await sql`
    UPDATE tasks SET status = 'client_ready' WHERE id = ${taskId}
  `

  // Credit points — guard against duplicate approvals on the same submission
  const month = new Date().toISOString().slice(0, 7)
  const existing = await sql`
    SELECT id FROM points_log WHERE submission_id = ${submissionId}
  `
  if (existing.length === 0) {
    await sql`
      INSERT INTO points_log (user_id, task_id, submission_id, points, month)
      VALUES (${task.assigned_to}, ${taskId}, ${submissionId}, ${task.points}, ${month})
    `
  }

  revalidatePath(`/tasks/${taskId}`)
  revalidatePath("/tasks")
  revalidatePath("/qc-queue")
}

export async function sendBackAction(
  taskId: string,
  submissionId: string,
  remarks: string
) {
  const session = await getSession()
  if (
    !session ||
    (!session.roles.includes("qc") && !session.roles.includes("manager"))
  ) {
    return { error: "Unauthorized" }
  }

  if (!remarks.trim()) return { error: "Remarks are required" }

  await sql`
    UPDATE submissions
    SET outcome = 'sent_back', reviewed_by = ${session.id}, remarks = ${remarks.trim()}
    WHERE id = ${submissionId}
  `

  await sql`
    UPDATE tasks SET status = 'revision_requested' WHERE id = ${taskId}
  `

  revalidatePath(`/tasks/${taskId}`)
  revalidatePath("/tasks")
  revalidatePath("/qc-queue")
}

export async function closeTaskAction(taskId: string) {
  const session = await getSession()
  if (!session || !session.roles.includes("manager"))
    return { error: "Unauthorized" }

  await sql`UPDATE tasks SET status = 'closed' WHERE id = ${taskId}`
  revalidatePath(`/tasks/${taskId}`)
  revalidatePath("/tasks")
}

export async function reopenForClientRevisionAction(
  taskId: string,
  revisionNotes: string,
  newPoints: number,
  newDesignerId: string | null
) {
  const session = await getSession()
  if (!session || !session.roles.includes("manager"))
    return { error: "Unauthorized" }

  // Drop restrictive check constraint if present in DB schema
  try {
    await sql`
      ALTER TABLE submissions DROP CONSTRAINT IF EXISTS submissions_outcome_check;
    `
  } catch (err) {
    console.error("Could not drop constraint submissions_outcome_check:", err)
  }

  // Update outcome of currently approved submission(s) for this task to 'reopened_for_revision'
  await sql`
    UPDATE submissions
    SET outcome = 'reopened_for_revision'
    WHERE task_id = ${taskId} AND outcome = 'approved'
  `

  await sql`
    UPDATE tasks
    SET
      status = 'assigned',
      revision_notes = ${revisionNotes},
      points = ${newPoints},
      assigned_to = ${newDesignerId}
    WHERE id = ${taskId}
  `

  revalidatePath(`/tasks/${taskId}`)
  revalidatePath("/tasks")
  revalidatePath("/dashboard")
}
