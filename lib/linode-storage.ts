import {
  S3Client,
  PutObjectCommand,
  ListObjectsV2Command,
  GetObjectCommand,
} from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import fs from "fs"
import path from "path"

export function getStorageConfig() {
  const accessKeyId =
    process.env.LINODE_OBJECT_STORAGE_ACCESS_KEY ||
    process.env.LINODE_ACCESS_KEY
  const secretAccessKey =
    process.env.LINODE_OBJECT_STORAGE_SECRET_KEY ||
    process.env.LINODE_SECRET_KEY
  const rawRegion = (
    process.env.LINODE_OBJECT_STORAGE_REGION ||
    process.env.LINODE_REGION ||
    "us-east-1"
  ).trim()

  const bucket =
    process.env.LINODE_OBJECT_STORAGE_BUCKET || process.env.LINODE_BUCKET || "cad-portal"

  // Clean region if domain was passed (e.g. in-maa-1.linodeobjects.com -> in-maa-1)
  const region = rawRegion.replace(/\.?linodeobjects\.com$/, "")

  const endpoint =
    process.env.LINODE_OBJECT_STORAGE_ENDPOINT ||
    `https://${region}.linodeobjects.com`

  if (!accessKeyId || !secretAccessKey) {
    return null
  }

  const client = new S3Client({
    region,
    endpoint,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  })

  return { client, region, endpoint, bucket }
}

function getContentType(filename: string): string {
  const ext = path.extname(filename).toLowerCase()
  const mimeTypes: Record<string, string> = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".3dm": "application/octet-stream",
    ".stl": "model/stl",
    ".stp": "application/step",
    ".step": "application/step",
    ".igs": "application/iges",
    ".iges": "application/iges",
    ".zip": "application/zip",
    ".pdf": "application/pdf",
    ".txt": "text/plain",
    ".db": "application/x-sqlite3",
    ".glb": "model/gltf-binary",
  }
  return mimeTypes[ext] || "application/octet-stream"
}

export async function createTaskFolderInStorage(
  taskId: string,
  folderName?: string
): Promise<{ key: string; url: string }> {
  const config = getStorageConfig()
  const targetFolder = folderName ? folderName.replace(/[^a-zA-Z0-9_.-]/g, "_") : taskId
  const key = `tasks/${targetFolder}/.keep`

  if (config && config.bucket) {
    const { client, region, bucket } = config
    try {
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: Buffer.from(`Task folder initialized: ${targetFolder} (ID: ${taskId})`),
          ContentType: "text/plain",
          ACL: "public-read",
        })
      )
      if (targetFolder !== taskId) {
        await client.send(
          new PutObjectCommand({
            Bucket: bucket,
            Key: `tasks/${taskId}/.keep`,
            Body: Buffer.from(`Task folder initialized: ${targetFolder} (ID: ${taskId})`),
            ContentType: "text/plain",
            ACL: "public-read",
          })
        ).catch(() => { })
      }
      const url = `https://${bucket}.${region}.linodeobjects.com/${key}`
      return { url, key }
    } catch (err) {
      console.error("Error creating Linode task folder marker:", err)
    }
  }

  // Fallback local storage directory creation
  const uploadDir = path.join(process.cwd(), "public", "uploads", "tasks", targetFolder)
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true })
  }
  const relativePath = `/uploads/tasks/${targetFolder}/.keep`
  return { url: relativePath, key: relativePath }
}

export type TaskFileCategory = "reference" | "cad" | "other"

export async function uploadTaskFile({
  taskId,
  category = "cad",
  version,
  buffer,
  filename,
  contentType,
}: {
  taskId: string
  category?: TaskFileCategory
  version?: string
  buffer: Buffer
  filename: string
  contentType?: string
}): Promise<{ url: string; key: string }> {
  const config = getStorageConfig()
  const cleanFilename = filename.replace(/[^a-zA-Z0-9_.-]/g, "_")
  const keyParts = ["tasks", taskId, category]
  if (version) keyParts.push(version)
  keyParts.push(cleanFilename)
  const key = keyParts.join("/")

  const finalContentType = contentType || getContentType(cleanFilename)

  if (config && config.bucket) {
    const { client, region, bucket } = config
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: buffer,
        ContentType: finalContentType,
        ACL: "public-read",
      })
    )
    const url = `https://${bucket}.${region}.linodeobjects.com/${key}`
    return { url, key }
  }

  // Fallback to local storage if Linode env variables are missing
  const uploadDir = path.join(
    process.cwd(),
    "public",
    "uploads",
    "tasks",
    taskId,
    category,
    version || ""
  )
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true })
  }
  const filePath = path.join(uploadDir, cleanFilename)
  fs.writeFileSync(filePath, buffer)
  const relativePath = `/uploads/tasks/${taskId}/${category}/${version ? version + "/" : ""}${cleanFilename}`
  return { url: relativePath, key: relativePath }
}

export async function listTaskFiles(taskId: string, folderName?: string) {
  const config = getStorageConfig()
  if (!config || !config.bucket) return []

  const { client, region, bucket } = config
  const prefixes = [`tasks/${taskId}/`]
  if (folderName && folderName !== taskId) {
    prefixes.unshift(`tasks/${folderName}/`)
    const baseFolderName = folderName.replace(/-V\d+$/i, "")
    if (baseFolderName && baseFolderName !== folderName) {
      prefixes.unshift(`tasks/${baseFolderName}`)
    }
  }

  const allFiles: Array<{ key: string; filename: string; size: number; lastModified?: Date; url: string }> = []
  const seenKeys = new Set<string>()

  for (const prefix of prefixes) {
    try {
      const response = await client.send(
        new ListObjectsV2Command({
          Bucket: bucket,
          Prefix: prefix,
        })
      )

      if (response.Contents) {
        for (const item of response.Contents) {
          const key = item.Key || ""
          if (!key || key.endsWith("/.keep") || seenKeys.has(key)) continue
          seenKeys.add(key)
          const filename = path.basename(key)
          const url = `https://${bucket}.${region}.linodeobjects.com/${key}`
          allFiles.push({
            key,
            filename,
            size: item.Size || 0,
            lastModified: item.LastModified,
            url,
          })
        }
      }
    } catch (err) {
      console.error(`Error listing task files from Linode S3 prefix ${prefix}:`, err)
    }
  }

  return allFiles
}

export async function getTaskFileStream(key: string) {
  const config = getStorageConfig()
  if (!config || !config.bucket) {
    throw new Error("Linode Object Storage credentials are not configured.")
  }

  const { client, bucket } = config
  const response = await client.send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    })
  )

  return {
    stream: response.Body,
    contentType: response.ContentType || getContentType(key),
    contentLength: response.ContentLength,
  }
}

/**
 * Uploads compressed image buffer to Linode Object Storage.
 * If credentials are not present in .env, falls back to local /public/uploads directory.
 */
export async function uploadToReferenceStorage(
  buffer: Buffer,
  filename: string,
  ext: string,
  taskId?: string
): Promise<string> {
  if (taskId) {
    const result = await uploadTaskFile({
      taskId,
      category: "reference",
      buffer,
      filename,
      contentType: getContentType(filename),
    })
    return result.url
  }

  const config = getStorageConfig()
  const bucket =
    process.env.LINODE_OBJECT_STORAGE_BUCKET || process.env.LINODE_BUCKET

  if (config && bucket) {
    const { client, region } = config
    const contentType = getContentType(filename)

    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: `reference-images/${filename}`,
        Body: buffer,
        ContentType: contentType,
        ACL: "public-read",
      })
    )

    return `https://${bucket}.${region}.linodeobjects.com/reference-images/${filename}`
  }

  // Fallback to local storage if Linode env variables are missing
  const uploadDir = path.join(
    process.cwd(),
    "public",
    "uploads",
    "reference-images"
  )
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true })
  }
  const filePath = path.join(uploadDir, filename)
  fs.writeFileSync(filePath, buffer)
  return `/uploads/reference-images/${filename}`
}

export async function generateReferencePresignedUploadUrl({
  filename,
  fileSize,
  contentType,
}: {
  filename: string
  fileSize?: number
  contentType?: string
}): Promise<{
  presignedUrl?: string
  fileUrl: string
  key: string
  isFallback?: boolean
}> {
  const ext = path.extname(filename).toLowerCase()
  const cleanBaseName = path.basename(filename, ext).replace(/[^a-zA-Z0-9_-]/g, "_")
  const safeFilename = `${Date.now()}_${cleanBaseName}${ext}`
  const key = `reference-images/${safeFilename}`
  const finalContentType = contentType || getContentType(filename)

  const config = getStorageConfig()

  if (config && config.bucket) {
    const { client, region, bucket } = config
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: finalContentType,
      ACL: "public-read",
    })

    const presignedUrl = await getSignedUrl(client, command, { expiresIn: 900 })
    const fileUrl = `https://${bucket}.${region}.linodeobjects.com/${key}`

    return { presignedUrl, fileUrl, key }
  }

  const relativePath = `/uploads/reference-images/${safeFilename}`
  return { fileUrl: relativePath, key: relativePath, isFallback: true }
}



const MAX_FILE_SIZE_BYTES = 1024 * 1024 * 1024 // 1 GB Max limit

export async function generatePresignedUploadUrl({
  taskId,
  category = "cad",
  version,
  filename,
  fileSize,
  contentType,
  folderName,
  cdProjectNo,
  customerProjectNo,
}: {
  taskId: string
  category?: TaskFileCategory
  version?: string
  filename: string
  fileSize?: number
  contentType?: string
  folderName?: string
  cdProjectNo?: string | null
  customerProjectNo?: string | null
}): Promise<{
  presignedUrl?: string
  fileUrl: string
  key: string
  version: string
  isFallback?: boolean
}> {
  // 1. Validate File Size
  if (fileSize && fileSize > MAX_FILE_SIZE_BYTES) {
    throw new Error("File size exceeds maximum allowed limit of 1 GB.")
  }

  const ext = path.extname(filename).toLowerCase()

  // 3. Filename Sanitization & Formatting (project_no - customer_project_no - version)
  const baseNameWithoutExt = path.basename(filename, ext)
  const cleanBaseName = baseNameWithoutExt.replace(/[^a-zA-Z0-9_-]/g, "_")

  const nameParts = [
    cdProjectNo,
    customerProjectNo,
    version,
  ].map((s) => (s || "").trim()).filter(Boolean)

  let formattedFilename: string
  if (nameParts.length > 0) {
    const formattedPrefix = nameParts.join("-")
    if (cleanBaseName.startsWith(formattedPrefix)) {
      formattedFilename = `${cleanBaseName}${ext}`
    } else {
      formattedFilename = `${formattedPrefix}_${cleanBaseName}${ext}`
    }
  } else {
    formattedFilename = `${cleanBaseName}${ext}`
  }

  const targetFolder = folderName ? folderName.replace(/[^a-zA-Z0-9_.-]/g, "_") : taskId
  const keyParts = ["tasks", targetFolder, category]
  if (version) keyParts.push(version)
  const timePrefix = Date.now()
  keyParts.push(`${timePrefix}_${formattedFilename}`)
  const key = keyParts.join("/")

  const finalContentType = contentType || getContentType(formattedFilename)

  const config = getStorageConfig()

  if (config && config.bucket) {
    const { client, region, bucket } = config
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: finalContentType,
      ACL: "public-read",
    })

    // Presigned URL valid for 15 minutes (900 seconds)
    const presignedUrl = await getSignedUrl(client, command, { expiresIn: 900 })
    const fileUrl = `https://${bucket}.${region}.linodeobjects.com/${key}`

    return { presignedUrl, fileUrl, key, version: version || "V1" }
  }

  // Fallback for local development environment if Linode Object Storage is not configured
  const relativePath = `/uploads/tasks/${taskId}/${category}/${version ? version + "/" : ""}${formattedFilename}`
  return {
    fileUrl: relativePath,
    key: relativePath,
    version: version || "V1",
    isFallback: true,
  }
}

