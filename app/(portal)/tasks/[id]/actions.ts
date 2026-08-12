"use server"

import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { sql } from "@/lib/db"
import { getSession } from "@/lib/session"
import { normalizeDeadlineForDb, normalizeRequestDateForDb } from "@/lib/task-utils"

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
      SET assigned_to = ${session.id}, status = 'in_progress', assigned_at = NOW()
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
  if (
    !session ||
    (!session.roles.includes("manager") && !session.roles.includes("qc"))
  )
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

  const assignedAtValue = newDesignerId ? new Date().toISOString() : null

  await sql`
    UPDATE tasks
    SET
      status = 'assigned',
      revision_notes = ${revisionNotes},
      points = ${newPoints},
      assigned_to = ${newDesignerId},
      assigned_at = ${assignedAtValue}
    WHERE id = ${taskId}
  `

  revalidatePath(`/tasks/${taskId}`)
  revalidatePath("/tasks")
  revalidatePath("/dashboard")
}

export async function updateTaskAction(
  taskId: string,
  data: any
) {
  const session = await getSession()
  if (!session || !session.roles.includes("manager")) {
    return { error: "Unauthorized" }
  }

  const { ensureTaskTableColumns } = await import("@/app/(portal)/tasks/new/actions")
  await ensureTaskTableColumns()

  // Fetch current task info to check if assigned_to is changing
  const cleanId = decodeURIComponent(taskId.trim())
  const currentTaskRows = await sql`
    SELECT id, assigned_to, assigned_at, reference_image FROM tasks
    WHERE LOWER(id::text) = LOWER(${cleanId})
       OR LOWER(readable_id) = LOWER(${cleanId})
       OR REPLACE(id::text, '-', '') = LOWER(REPLACE(${cleanId}, '-', ''))
  `
  if (!currentTaskRows.length) {
    return { error: "Task not found" }
  }
  const currentTask = currentTaskRows[0] as {
    id: string
    assigned_to: string | null
    assigned_at: string | null
    reference_image: string | null
  }

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
  let referenceImageUrl: string | null = currentTask.reference_image
  const newReferenceUrls: string[] = []

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
    const reqDateRaw = (data.get("request_date") as string) || null
    requestDate = normalizeRequestDateForDb(reqDateRaw)
    title = (data.get("title") as string) || customerProjectNo || cdProjectNo || "Untitled Task"
    styleRefNumber = (data.get("style_ref_number") as string) || null
    description = (data.get("description") as string) || null
    const pointsRaw = data.get("points") as string
    points = pointsRaw ? parseFloat(pointsRaw) : 0
    const deadlineRaw = (data.get("deadline") as string) || null
    deadline = normalizeDeadlineForDb(deadlineRaw)
    driveFolderLink = (data.get("drive_folder_link") as string) || null
    assignedTo = (data.get("assigned_to") as string) || null
    priority = speed === "U" ? "high" : "medium"

    const imageFiles = data.getAll("reference_image") as File[]
    if (imageFiles.length > 0) {
      const { compressImage } = await import("@/lib/image-compress")
      const { uploadToReferenceStorage } = await import("@/lib/linode-storage")
      for (let i = 0; i < imageFiles.length; i++) {
        const imageFile = imageFiles[i]
        if (imageFile && imageFile.size > 0) {
          try {
            const bytes = await imageFile.arrayBuffer()
            const inputBuffer = Buffer.from(bytes)
            const { compressedBuffer, ext } = await compressImage(inputBuffer, imageFile.name)
            const safeFilename = `${Date.now()}_${i}_img${ext}`
            const storedUrl = await uploadToReferenceStorage(compressedBuffer, safeFilename, ext)
            newReferenceUrls.push(storedUrl)
          } catch (uploadErr) {
            console.error("Error saving reference image file:", uploadErr)
          }
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
    const reqDateRaw = data.request_date || null
    requestDate = normalizeRequestDateForDb(reqDateRaw)
    title = data.title || customerProjectNo || cdProjectNo || "Untitled Task"
    styleRefNumber = data.style_ref_number || null
    description = data.description || null
    points = typeof data.points === "number" ? data.points : (data.points ? parseFloat(String(data.points)) : 0)
    const deadlineRaw = data.deadline || null
    deadline = normalizeDeadlineForDb(deadlineRaw)
    driveFolderLink = data.drive_folder_link || null
    assignedTo = data.assigned_to || null
    priority = speed === "U" ? "high" : "medium"

    const base64List = data.referenceImageBase64s || (data.referenceImageBase64 ? [data.referenceImageBase64] : [])
    if (base64List.length > 0) {
      const { compressImage } = await import("@/lib/image-compress")
      const { uploadToReferenceStorage } = await import("@/lib/linode-storage")
      for (let i = 0; i < base64List.length; i++) {
        const b64 = base64List[i]
        if (b64) {
          try {
            const base64Data = b64.replace(/^data:image\/\w+;base64,/, "")
            const inputBuffer = Buffer.from(base64Data, "base64")
            const { compressedBuffer, ext } = await compressImage(inputBuffer)
            const safeFilename = `${Date.now()}_${i}_img${ext}`
            const storedUrl = await uploadToReferenceStorage(compressedBuffer, safeFilename, ext)
            newReferenceUrls.push(storedUrl)
          } catch (uploadErr) {
            console.error("Error saving base64 reference image:", uploadErr)
          }
        }
      }
    }
  }

  if (newReferenceUrls.length > 0) {
    let existingUrls: string[] = []
    if (currentTask.reference_image) {
      try {
        existingUrls = JSON.parse(currentTask.reference_image)
        if (!Array.isArray(existingUrls)) existingUrls = [currentTask.reference_image]
      } catch (e) {
        existingUrls = [currentTask.reference_image]
      }
    }
    referenceImageUrl = JSON.stringify([...existingUrls, ...newReferenceUrls])
  }

  if (!clientName) {
    return { error: "Customer name is required" }
  }

  const targetAssignedTo = (assignedTo && assignedTo.trim() !== "" && assignedTo !== "unassigned") ? assignedTo : null

  let assignedAtSql = sql`NULL`
  if (targetAssignedTo) {
    if (targetAssignedTo !== currentTask.assigned_to || !currentTask.assigned_at) {
      assignedAtSql = sql`NOW()`
    } else {
      const existingIso = new Date(currentTask.assigned_at).toISOString()
      assignedAtSql = sql`${existingIso}::timestamptz`
    }
  }

  await sql`
    UPDATE tasks
    SET
      title = ${title},
      client_name = ${clientName},
      style_ref_number = ${styleRefNumber},
      description = ${description},
      points = ${points},
      priority = ${priority},
      deadline = ${deadline},
      drive_folder_link = ${driveFolderLink},
      assigned_to = ${targetAssignedTo},
      assigned_at = ${assignedAtSql},
      customer_project_no = ${customerProjectNo},
      speed = ${speed},
      customer_code = ${customerCode},
      category_code = ${categoryCode},
      complexity = ${complexity},
      work_type = ${workType},
      version = ${version},
      sr_no = ${srNo},
      cd_project_no = ${cdProjectNo},
      request_date = ${requestDate},
      reference_image = ${referenceImageUrl}
    WHERE id = ${currentTask.id}
  `

  revalidatePath(`/tasks/${taskId}`)
  revalidatePath("/tasks")
  revalidatePath("/dashboard")
  revalidatePath("/qc-queue")
  return { success: true }
}

