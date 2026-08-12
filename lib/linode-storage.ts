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
  }
  return mimeTypes[ext] || "application/octet-stream"
}

export async function createTaskFolderInStorage(
  taskId: string,
  folderName?: string
): Promise<{ key: string; url: string }> {
  const config = getStorageConfig()
  const key = `tasks/${taskId}/.keep`

  if (config && config.bucket) {
    const { client, region, bucket } = config
    try {
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: Buffer.from(`Task folder initialized for ID: ${taskId}${folderName ? ` (${folderName})` : ""}`),
          ContentType: "text/plain",
          ACL: "public-read",
        })
      )
      const url = `https://${bucket}.${region}.linodeobjects.com/${key}`
      return { url, key }
    } catch (err) {
      console.error("Error creating Linode task folder marker:", err)
    }
  }

  // Fallback local storage directory creation
  const uploadDir = path.join(process.cwd(), "public", "uploads", "tasks", taskId)
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true })
  }
  const relativePath = `/uploads/tasks/${taskId}/.keep`
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

export async function listTaskFiles(taskId: string) {
  const config = getStorageConfig()
  if (!config || !config.bucket) return []

  const { client, region, bucket } = config
  const prefix = `tasks/${taskId}/`

  try {
    const response = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
      })
    )

    if (!response.Contents) return []

    return response.Contents.map((item) => {
      const key = item.Key || ""
      const filename = path.basename(key)
      const url = `https://${bucket}.${region}.linodeobjects.com/${key}`
      return {
        key,
        filename,
        size: item.Size || 0,
        lastModified: item.LastModified,
        url,
      }
    })
  } catch (err) {
    console.error("Error listing task files from Linode S3:", err)
    return []
  }
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

const ALLOWED_EXTENSIONS = new Set([
  ".3dm",
  ".stl",
  ".stp",
  ".step",
  ".igs",
  ".iges",
  ".zip",
  ".pdf",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".txt",
  ".dwg",
  ".dxf",
  ".obj",
  ".fbx",
  ".gcode",
])

const MAX_FILE_SIZE_BYTES = 1024 * 1024 * 1024 // 1 GB Max limit

export async function generatePresignedUploadUrl({
  taskId,
  category = "cad",
  version,
  filename,
  fileSize,
  contentType,
}: {
  taskId: string
  category?: TaskFileCategory
  version?: string
  filename: string
  fileSize?: number
  contentType?: string
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

  // 2. Strict File Extension Whitelisting
  const ext = path.extname(filename).toLowerCase()
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    throw new Error(
      `File extension '${ext}' is not allowed. Allowed formats: .3dm, .stl, .step, .igs, .zip, .pdf, .png, .jpg`
    )
  }

  // 3. Filename Sanitization & Path Traversal Prevention
  const baseNameWithoutExt = path.basename(filename, ext)
  const cleanBaseName = baseNameWithoutExt.replace(/[^a-zA-Z0-9_-]/g, "_")
  const cleanFilename = `${cleanBaseName}${ext}`

  const keyParts = ["tasks", taskId, category]
  if (version) keyParts.push(version)
  const timePrefix = Date.now()
  keyParts.push(`${timePrefix}_${cleanFilename}`)
  const key = keyParts.join("/")

  const finalContentType = contentType || getContentType(cleanFilename)

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
  const relativePath = `/uploads/tasks/${taskId}/${category}/${version ? version + "/" : ""}${cleanFilename}`
  return {
    fileUrl: relativePath,
    key: relativePath,
    version: version || "V1",
    isFallback: true,
  }
}

