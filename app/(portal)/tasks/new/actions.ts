"use server"

import { redirect } from "next/navigation"
import { sql } from "@/lib/db"
import { getSession } from "@/lib/session"

export async function createTaskAction(formData: FormData) {
  const session = await getSession()
  if (!session || (!session.roles.includes("manager") && !session.roles.includes("qc"))) {
    return { error: "Unauthorized" }
  }

  const title = formData.get("title") as string
  const clientName = formData.get("client_name") as string
  const styleRefNumber = formData.get("style_ref_number") as string
  const description = formData.get("description") as string
  const points = parseInt(formData.get("points") as string, 10)
  const deadline = (formData.get("deadline") as string) || null
  const driveFolderLink = (formData.get("drive_folder_link") as string) || null
  const assignedTo = (formData.get("assigned_to") as string) || null

  if (!title || !clientName || !points) {
    return { error: "Title, client name, and points are required" }
  }

  const rows = await sql`
    INSERT INTO tasks (
      title, client_name, style_ref_number, description, points,
      priority, deadline, drive_folder_link, assigned_to, created_by, status
    ) VALUES (
      ${title}, ${clientName}, ${styleRefNumber || null}, ${description || null},
      ${points}, 'low', ${deadline}, ${driveFolderLink},
      ${assignedTo}, ${session.id}, 'assigned'
    )
    RETURNING id
  `

  const taskId = (rows[0] as { id: string }).id
  redirect(`/tasks/${taskId}`)
}
