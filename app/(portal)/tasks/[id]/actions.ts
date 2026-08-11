"use server"

import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { sql } from "@/lib/db"
import { getSession } from "@/lib/session"

export async function assignToMeAction(taskId: string) {
  try {
    const session = await getSession()
    if (!session) return { error: "Unauthorized" }
    const canWork =
      session.roles.includes("designer") || session.roles.includes("qc")
    if (!canWork) return { error: "Unauthorized" }

    // Only allow claiming if the task is unassigned (open task) or pre-assigned to this user
    const rows = await sql`
      SELECT assigned_to, status FROM tasks WHERE id = ${taskId}
    `
    if (rows.length === 0) return { error: "Task not found" }

    const task = rows[0] as { assigned_to: string | null; status: string }
    if (task.status !== "assigned") {
      return { error: "This task is no longer available for assignment" }
    }

    if (task.assigned_to !== null && task.assigned_to !== session.id) {
      return { error: "This task is assigned to another designer" }
    }

    // Set assigned_to to designer's ID and status to in_progress
    await sql`
      UPDATE tasks
      SET assigned_to = ${session.id}, status = 'in_progress'
      WHERE id = ${taskId} AND status = 'assigned'
        AND (assigned_to IS NULL OR assigned_to = ${session.id})
    `

    revalidatePath(`/tasks/${taskId}`)
    revalidatePath("/tasks")
    revalidatePath("/dashboard")
    revalidatePath("/qc-queue")
    return { success: true }
  } catch (err: any) {
    console.error("assignToMeAction error:", err)
    return { error: err.message || "Failed to assign task." }
  }
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
  try {
    const session = await getSession()
    if (
      !session ||
      (!session.roles.includes("qc") && !session.roles.includes("manager"))
    ) {
      return { error: "Unauthorized" }
    }

    // Drop restrictive check constraint if present in DB schema
    try {
      await sql`
        ALTER TABLE submissions DROP CONSTRAINT IF EXISTS submissions_outcome_check;
      `
    } catch (err) {
      // Ignore if constraint doesn't exist
    }

    // Get task info for points
    const taskRows = await sql`
      SELECT points, assigned_to FROM tasks WHERE id = ${taskId}
    `
    if (!taskRows.length) {
      return { error: "Task not found" }
    }
    const task = taskRows[0] as { points: number | null; assigned_to: string | null }

    // Get submission info to identify submitted_by as fallback
    const subRows = await sql`
      SELECT submitted_by FROM submissions WHERE id = ${submissionId}
    `
    const submission = subRows[0] as { submitted_by: string } | undefined

    const recipientId = task.assigned_to || submission?.submitted_by || session.id

    // Update submission
    await sql`
      UPDATE submissions
      SET outcome = 'approved', reviewed_by = ${session.id}
      WHERE id = ${submissionId}
    `

    // Update task status, and assign task if it was unassigned
    if (recipientId && !task.assigned_to) {
      await sql`
        UPDATE tasks SET status = 'client_ready', assigned_to = ${recipientId} WHERE id = ${taskId}
      `
    } else {
      await sql`
        UPDATE tasks SET status = 'client_ready' WHERE id = ${taskId}
      `
    }

    // Credit points — guard against duplicate approvals on the same submission
    if (recipientId) {
      const month = new Date().toISOString().slice(0, 7)
      const points = task.points ? Number(task.points) : 0
      const existing = await sql`
        SELECT id FROM points_log WHERE submission_id = ${submissionId}
      `
      if (existing.length === 0) {
        try {
          await sql`ALTER TABLE points_log ALTER COLUMN points TYPE NUMERIC(10,2) USING points::numeric;`
        } catch (err) {
          // Column might already be numeric
        }
        await sql`
          INSERT INTO points_log (user_id, task_id, submission_id, points, month)
          VALUES (${recipientId}, ${taskId}, ${submissionId}, ${points}, ${month})
        `
      }
    }

    revalidatePath(`/tasks/${taskId}`)
    revalidatePath("/tasks")
    revalidatePath("/qc-queue")
    return { success: true }
  } catch (err: any) {
    console.error("Error approving submission:", err)
    return { error: err.message || "Failed to approve task submission." }
  }
}

export async function sendBackAction(
  taskId: string,
  submissionId: string,
  remarks: string
) {
  try {
    const session = await getSession()
    if (
      !session ||
      (!session.roles.includes("qc") && !session.roles.includes("manager"))
    ) {
      return { error: "Unauthorized" }
    }

    if (!remarks.trim()) return { error: "Remarks are required" }

    // Drop restrictive check constraint if present in DB schema
    try {
      await sql`
        ALTER TABLE submissions DROP CONSTRAINT IF EXISTS submissions_outcome_check;
      `
    } catch (err) {
      // Ignore
    }

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
    return { success: true }
  } catch (err: any) {
    console.error("Error sending back submission:", err)
    return { error: err.message || "Failed to send back submission." }
  }
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
