"use server"

import { redirect } from "next/navigation"
import { sql } from "@/lib/db"
import { getSession } from "@/lib/session"
import fs from "fs"
import path from "path"

export async function ensureTaskTableColumns() {
  await sql`
    ALTER TABLE tasks
    ADD COLUMN IF NOT EXISTS customer_project_no TEXT,
    ADD COLUMN IF NOT EXISTS speed TEXT,
    ADD COLUMN IF NOT EXISTS customer_code TEXT,
    ADD COLUMN IF NOT EXISTS category_code TEXT,
    ADD COLUMN IF NOT EXISTS complexity TEXT,
    ADD COLUMN IF NOT EXISTS work_type TEXT,
    ADD COLUMN IF NOT EXISTS sr_no TEXT,
    ADD COLUMN IF NOT EXISTS cd_project_no TEXT,
    ADD COLUMN IF NOT EXISTS request_date DATE,
    ADD COLUMN IF NOT EXISTS reference_image TEXT;
  `
}

export async function createTaskAction(formData: FormData) {
  const session = await getSession()
  if (
    !session ||
    (!session.roles.includes("manager") && !session.roles.includes("qc"))
  ) {
    return { error: "Unauthorized" }
  }

  await ensureTaskTableColumns()

  const customerProjectNo = (formData.get("customer_project_no") as string) || null
  const speed = (formData.get("speed") as string) || null
  const customerCode = (formData.get("customer_code") as string) || null
  const clientName = (formData.get("client_name") as string) || null
  const categoryCode = (formData.get("category_code") as string) || null
  const complexity = (formData.get("complexity") as string) || null
  const workType = (formData.get("work_type") as string) || "New"
  const srNo = (formData.get("sr_no") as string) || null
  const cdProjectNo = (formData.get("cd_project_no") as string) || null
  const requestDate = (formData.get("request_date") as string) || null

  const title = (formData.get("title") as string) || customerProjectNo || cdProjectNo || "Untitled Task"
  const styleRefNumber = (formData.get("style_ref_number") as string) || null
  const description = (formData.get("description") as string) || null

  const pointsRaw = formData.get("points") as string
  const points = pointsRaw ? parseInt(pointsRaw, 10) : 0

  const deadline = (formData.get("deadline") as string) || null
  const driveFolderLink = (formData.get("drive_folder_link") as string) || null
  const assignedTo = (formData.get("assigned_to") as string) || null
  const priority = speed === "U" ? "high" : "medium"

  // Handle reference image upload
  let referenceImageUrl: string | null = null
  const imageFile = formData.get("reference_image") as File | null
  if (imageFile && imageFile.size > 0) {
    try {
      const bytes = await imageFile.arrayBuffer()
      const buffer = Buffer.from(bytes)
      const uploadDir = path.join(process.cwd(), "public", "uploads", "reference-images")
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true })
      }
      const safeFilename = `${Date.now()}_${imageFile.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`
      const filePath = path.join(uploadDir, safeFilename)
      fs.writeFileSync(filePath, buffer)
      referenceImageUrl = `/uploads/reference-images/${safeFilename}`
    } catch (uploadErr) {
      console.error("Error saving reference image file:", uploadErr)
    }
  }

  if (!clientName) {
    return { error: "Customer name is required" }
  }

  const rows = await sql`
    INSERT INTO tasks (
      title, client_name, style_ref_number, description, points,
      priority, deadline, drive_folder_link, assigned_to, created_by, status,
      customer_project_no, speed, customer_code, category_code, complexity,
      work_type, sr_no, cd_project_no, request_date, reference_image
    ) VALUES (
      ${title}, ${clientName}, ${styleRefNumber}, ${description},
      ${points}, ${priority}, ${deadline}, ${driveFolderLink},
      ${assignedTo}, ${session.id}, 'assigned',
      ${customerProjectNo}, ${speed}, ${customerCode}, ${categoryCode}, ${complexity},
      ${workType}, ${srNo}, ${cdProjectNo}, ${requestDate}, ${referenceImageUrl}
    )
    RETURNING id
  `

  const taskId = (rows[0] as { id: string }).id
  redirect(`/tasks/${taskId}`)
}

