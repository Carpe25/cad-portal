"use server"

import { redirect } from "next/navigation"
import { sql } from "@/lib/db"
import { getSession } from "@/lib/session"
import fs from "fs"
import path from "path"

import { compressImage } from "@/lib/image-compress"
import { uploadToReferenceStorage } from "@/lib/linode-storage"

export async function ensureTaskTableColumns() {
  await sql`
    ALTER TABLE tasks
    ADD COLUMN IF NOT EXISTS customer_project_no TEXT,
    ADD COLUMN IF NOT EXISTS speed TEXT,
    ADD COLUMN IF NOT EXISTS customer_code TEXT,
    ADD COLUMN IF NOT EXISTS category_code TEXT,
    ADD COLUMN IF NOT EXISTS complexity TEXT,
    ADD COLUMN IF NOT EXISTS work_type TEXT,
    ADD COLUMN IF NOT EXISTS version TEXT,
    ADD COLUMN IF NOT EXISTS sr_no TEXT,
    ADD COLUMN IF NOT EXISTS cd_project_no TEXT,
    ADD COLUMN IF NOT EXISTS request_date DATE,
    ADD COLUMN IF NOT EXISTS reference_image TEXT;
  `
  try {
    await sql`ALTER TABLE tasks ALTER COLUMN points TYPE NUMERIC(10,2) USING points::numeric;`
  } catch (err) {
    // Column might already be numeric
  }
  try {
    await sql`ALTER TABLE points_log ALTER COLUMN points TYPE NUMERIC(10,2) USING points::numeric;`
  } catch (err) {
    // Column might already be numeric
  }
}

function normalizeDateForDb(dateStr: string | null): string | null {
  if (!dateStr) return null
  const trimmed = dateStr.trim()
  const parts = trimmed.split("-")
  if (parts.length === 3 && parts[2].length === 4) {
    // DD-MM-YYYY -> YYYY-MM-DD
    return `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`
  }
  return trimmed
}

export type CreateTaskPayload = {
  customer_project_no?: string | null
  speed?: string | null
  customer_code?: string | null
  client_name?: string | null
  category_code?: string | null
  complexity?: string | null
  work_type?: string | null
  version?: string | null
  sr_no?: string | null
  cd_project_no?: string | null
  request_date?: string | null
  title?: string | null
  style_ref_number?: string | null
  description?: string | null
  points?: string | number | null
  deadline?: string | null
  drive_folder_link?: string | null
  assigned_to?: string | null
  priority?: string | null
  referenceImageBase64s?: string[] | null
  referenceImageBase64?: string | null
  referenceImageName?: string | null
}

export async function createTaskAction(data: CreateTaskPayload | FormData) {
  const session = await getSession()
  if (
    !session ||
    (!session.roles.includes("manager") && !session.roles.includes("qc"))
  ) {
    return { error: "Unauthorized" }
  }

  await ensureTaskTableColumns()

  let customerProjectNo: string | null = null
  let speed: string | null = null
  let customerCode: string | null = null
  let clientName: string | null = null
  let categoryCode: string | null = null
  let complexity: string | null = null
  let workType = "New"
  let version = "V1"
  let srNo: string | null = null
  let cdProjectNo: string | null = null
  let requestDate: string | null = null
  let title = "Untitled Task"
  let styleRefNumber: string | null = null
  let description: string | null = null
  let points = 0
  let deadline: string | null = null
  let driveFolderLink: string | null = null
  let assignedTo: string | null = null
  let priority = "medium"
  let referenceImageUrl: string | null = null
  const referenceUrls: string[] = []

  if (data instanceof FormData) {
    customerProjectNo = (data.get("customer_project_no") as string) || null
    speed = (data.get("speed") as string) || null
    customerCode = (data.get("customer_code") as string) || null
    clientName = (data.get("client_name") as string) || null
    categoryCode = (data.get("category_code") as string) || null
    complexity = (data.get("complexity") as string) || null
    workType = (data.get("work_type") as string) || "New"
    version = (data.get("version") as string) || "V1"
    srNo = (data.get("sr_no") as string) || null
    cdProjectNo = (data.get("cd_project_no") as string) || null
    requestDate = normalizeDateForDb((data.get("request_date") as string) || null)
    title = (data.get("title") as string) || customerProjectNo || cdProjectNo || "Untitled Task"
    styleRefNumber = (data.get("style_ref_number") as string) || null
    description = (data.get("description") as string) || null
    const pointsRaw = data.get("points") as string
    points = pointsRaw ? parseFloat(pointsRaw) : 0
    deadline = normalizeDateForDb((data.get("deadline") as string) || null)
    driveFolderLink = (data.get("drive_folder_link") as string) || null
    assignedTo = (data.get("assigned_to") as string) || null
    priority = speed === "U" ? "high" : "medium"

    const imageFiles = data.getAll("reference_image") as File[]
    for (let i = 0; i < imageFiles.length; i++) {
      const imageFile = imageFiles[i]
      if (imageFile && imageFile.size > 0) {
        try {
          const bytes = await imageFile.arrayBuffer()
          const inputBuffer = Buffer.from(bytes)
          const { compressedBuffer, ext } = await compressImage(inputBuffer, imageFile.name)

          const safeFilename = `${Date.now()}_${i}_img${ext}`
          const storedUrl = await uploadToReferenceStorage(compressedBuffer, safeFilename, ext)
          referenceUrls.push(storedUrl)
        } catch (uploadErr) {
          console.error("Error saving reference image file:", uploadErr)
        }
      }
    }
  } else {
    customerProjectNo = data.customer_project_no || null
    speed = data.speed || null
    customerCode = data.customer_code || null
    clientName = data.client_name || null
    categoryCode = data.category_code || null
    complexity = data.complexity || null
    workType = data.work_type || "New"
    version = data.version || "V1"
    srNo = data.sr_no || null
    cdProjectNo = data.cd_project_no || null
    requestDate = normalizeDateForDb(data.request_date || null)
    title = data.title || customerProjectNo || cdProjectNo || "Untitled Task"
    styleRefNumber = data.style_ref_number || null
    description = data.description || null
    points = typeof data.points === "number" ? data.points : (data.points ? parseFloat(String(data.points)) : 0)
    deadline = normalizeDateForDb(data.deadline || null)
    driveFolderLink = data.drive_folder_link || null
    assignedTo = data.assigned_to || null
    priority = speed === "U" ? "high" : "medium"

    const base64List = data.referenceImageBase64s || (data.referenceImageBase64 ? [data.referenceImageBase64] : [])
    for (let i = 0; i < base64List.length; i++) {
      const b64 = base64List[i]
      if (b64) {
        try {
          const base64Data = b64.replace(/^data:image\/\w+;base64,/, "")
          const inputBuffer = Buffer.from(base64Data, "base64")
          const { compressedBuffer, ext } = await compressImage(inputBuffer)

          const safeFilename = `${Date.now()}_${i}_img${ext}`
          const storedUrl = await uploadToReferenceStorage(compressedBuffer, safeFilename, ext)
          referenceUrls.push(storedUrl)
        } catch (uploadErr) {
          console.error("Error saving base64 reference image:", uploadErr)
        }
      }
    }
  }

  if (referenceUrls.length > 0) {
    referenceImageUrl = JSON.stringify(referenceUrls)
  }

  if (!clientName) {
    return { error: "Customer name is required" }
  }

  const rows = await sql`
    INSERT INTO tasks (
      title, client_name, style_ref_number, description, points,
      priority, deadline, drive_folder_link, assigned_to, created_by, status,
      customer_project_no, speed, customer_code, category_code, complexity,
      work_type, version, sr_no, cd_project_no, request_date, reference_image
    ) VALUES (
      ${title}, ${clientName}, ${styleRefNumber}, ${description},
      ${points}, ${priority}, ${deadline}, ${driveFolderLink},
      ${assignedTo}, ${session.id}, 'assigned',
      ${customerProjectNo}, ${speed}, ${customerCode}, ${categoryCode}, ${complexity},
      ${workType}, ${version}, ${srNo}, ${cdProjectNo}, ${requestDate}, ${referenceImageUrl}
    )
    RETURNING id
  `

  const taskId = (rows[0] as { id: string }).id
  redirect(`/tasks/${taskId}`)
}

export async function createDriveFolderAction(folderName: string) {
  const session = await getSession()
  if (
    !session ||
    (!session.roles.includes("manager") && !session.roles.includes("qc"))
  ) {
    return { error: "Unauthorized" }
  }

  try {
    const { createGoogleDriveFolder } = await import("@/lib/drive")
    const result = await createGoogleDriveFolder(folderName)
    return { folderUrl: result.folderUrl }
  } catch (err: any) {
    console.error("createDriveFolderAction error:", err)
    return { error: err.message || "Failed to create Google Drive folder." }
  }
}


