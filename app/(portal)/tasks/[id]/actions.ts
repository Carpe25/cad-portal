"use server"

import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { sql } from "@/lib/db"
import { getSession } from "@/lib/session"

export async function assignToMeAction(taskId: string) {
  const session = await getSession()
  if (!session) return { error: "Unauthorized" }

  await sql`
    UPDATE tasks
    SET assigned_to = ${session.id}, status = 'in_progress'
    WHERE id = ${taskId} AND status = 'assigned'
  `
  revalidatePath(`/tasks/${taskId}`)
  revalidatePath("/tasks")
}

export async function submitForQCAction(taskId: string, driveLink: string) {
  const session = await getSession()
  if (!session) return { error: "Unauthorized" }

  if (!driveLink.trim()) return { error: "Drive link is required" }

  // Count existing submissions to determine version number
  const countRows = await sql`
    SELECT COUNT(*) FROM submissions WHERE task_id = ${taskId}
  `
  const count = parseInt((countRows[0] as { count: string }).count, 10)
  const version = `V${count + 1}`

  await sql`
    INSERT INTO submissions (task_id, version, drive_link, submitted_by, outcome)
    VALUES (${taskId}, ${version}, ${driveLink.trim()}, ${session.id}, 'pending')
  `

  await sql`
    UPDATE tasks SET status = 'in_qc_review' WHERE id = ${taskId}
  `

  revalidatePath(`/tasks/${taskId}`)
}

export async function approveSubmissionAction(
  taskId: string,
  submissionId: string
) {
  const session = await getSession()
  if (!session || (!session.roles.includes("qc") && !session.roles.includes("manager"))) {
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

  // Credit points
  const month = new Date().toISOString().slice(0, 7)
  await sql`
    INSERT INTO points_log (user_id, task_id, submission_id, points, month)
    VALUES (${task.assigned_to}, ${taskId}, ${submissionId}, ${task.points}, ${month})
    ON CONFLICT DO NOTHING
  `

  revalidatePath(`/tasks/${taskId}`)
  revalidatePath("/qc-queue")
}

export async function sendBackAction(
  taskId: string,
  submissionId: string,
  remarks: string
) {
  const session = await getSession()
  if (!session || (!session.roles.includes("qc") && !session.roles.includes("manager"))) {
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
  revalidatePath("/qc-queue")
}

export async function closeTaskAction(taskId: string) {
  const session = await getSession()
  if (!session || !session.roles.includes("manager")) return { error: "Unauthorized" }

  await sql`UPDATE tasks SET status = 'closed' WHERE id = ${taskId}`
  revalidatePath(`/tasks/${taskId}`)
}

export async function reopenForClientRevisionAction(
  taskId: string,
  revisionNotes: string,
  newPoints: number,
  newDesignerId: string | null
) {
  const session = await getSession()
  if (!session || !session.roles.includes("manager")) return { error: "Unauthorized" }

  await sql`
    UPDATE tasks
    SET
      status = 'assigned',
      revision_notes = ${revisionNotes},
      points = ${newPoints},
      assigned_to = COALESCE(${newDesignerId}, assigned_to)
    WHERE id = ${taskId}
  `

  revalidatePath(`/tasks/${taskId}`)
}
