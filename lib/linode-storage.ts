import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3"
import fs from "fs"
import path from "path"

function getStorageConfig() {
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

  return { client, region, endpoint }
}

/**
 * Uploads compressed image buffer to Linode Object Storage.
 * If credentials are not present in .env, falls back to local /public/uploads directory.
 */
export async function uploadToReferenceStorage(
  buffer: Buffer,
  filename: string,
  ext: string
): Promise<string> {
  const config = getStorageConfig()
  const bucket =
    process.env.LINODE_OBJECT_STORAGE_BUCKET || process.env.LINODE_BUCKET

  if (config && bucket) {
    const { client, region } = config
    const mimeTypes: Record<string, string> = {
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".webp": "image/webp",
      ".gif": "image/gif",
    }
    const contentType = mimeTypes[ext.toLowerCase()] || "image/png"

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
