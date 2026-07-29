import { google } from "googleapis"
import { Readable } from "stream"

export function extractDriveFolderId(url: string): string | null {
  const match = url.match(/\/folders\/([a-zA-Z0-9_-]+)/)
  return match ? match[1] : null
}

export function getDriveEmbedUrl(folderId: string): string {
  return `https://drive.google.com/embeddedfolderview?id=${folderId}#list`
}

function formatPrivateKey(rawKey: string): string {
  if (!rawKey) return ""
  let key = rawKey.trim()

  // Remove wrapping double or single quotes if present
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1)
  }

  // Replace literal '\n' string representations with actual newline characters
  key = key.replace(/\\n/g, "\n")

  // Fix accidental extra 'n' at beginning of PEM body (e.g. -----BEGIN PRIVATE KEY-----\nnMII -> \nMII)
  key = key.replace(/(-----BEGIN PRIVATE KEY-----\s*)n+(MII)/g, "$1$2")

  return key
}

function getDriveClient() {
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL
  const rawPrivateKey = process.env.GOOGLE_PRIVATE_KEY

  if (!clientEmail || !rawPrivateKey) {
    throw new Error(
      "Google Drive API credentials (GOOGLE_CLIENT_EMAIL, GOOGLE_PRIVATE_KEY) are missing in environment variables."
    )
  }

  const privateKey = formatPrivateKey(rawPrivateKey)

  const delegateEmail = process.env.GOOGLE_DRIVE_DELEGATE_EMAIL

  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/drive"],
    subject: delegateEmail || undefined,
  })

  return google.drive({ version: "v3", auth })
}

export async function createGoogleDriveFolder(
  folderName: string
): Promise<{ folderId: string; folderUrl: string }> {
  try {
    const drive = getDriveClient()
    const parentFolderId = process.env.GOOGLE_DRIVE_PARENT_FOLDER_ID
    const targetEmail = process.env.GOOGLE_DRIVE_TARGET_EMAIL

    const fileMetadata: Record<string, unknown> = {
      name: folderName,
      mimeType: "application/vnd.google-apps.folder",
    }

    if (parentFolderId) {
      fileMetadata.parents = [parentFolderId]
    }

    const response = await drive.files.create({
      requestBody: fileMetadata,
      supportsAllDrives: true,
      fields: "id, webViewLink",
    })

    const folderId = response.data.id
    if (!folderId) {
      throw new Error(
        "Failed to retrieve created folder ID from Google Drive response."
      )
    }

    const folderUrl =
      response.data.webViewLink ||
      `https://drive.google.com/drive/folders/${folderId}`

    // Share permission with target email so target email has editor access to created folder
    if (targetEmail) {
      try {
        await drive.permissions.create({
          fileId: folderId,
          supportsAllDrives: true,
          requestBody: {
            role: "writer",
            type: "user",
            emailAddress: targetEmail,
          },
        })
      } catch (permError) {
        console.error("Error sharing folder permission with target email:", permError)
      }
    }

    return { folderId, folderUrl }
  } catch (error: any) {
    console.error("Error in createGoogleDriveFolder:", error)
    throw new Error(error.message || "Failed to create Google Drive folder.")
  }
}

export async function uploadFilesToDriveFolder(
  folderId: string,
  files: Array<{ name: string; mimeType: string; buffer: Buffer }>
): Promise<{ uploadedCount: number }> {
  try {
    const drive = getDriveClient()
    const targetEmail = process.env.GOOGLE_DRIVE_TARGET_EMAIL
    let uploadedCount = 0

    for (const file of files) {
      const fileMetadata = {
        name: file.name,
        parents: [folderId],
      }

      // Generate a fresh Readable stream for each file upload attempt to avoid stream.push() after EOF
      const getFreshMedia = () => ({
        mimeType: file.mimeType || "application/octet-stream",
        body: Readable.from(file.buffer),
      })

      const response = await drive.files.create({
        requestBody: fileMetadata,
        media: getFreshMedia(),
        supportsAllDrives: true,
        fields: "id",
      })

      const fileId = response.data.id
      if (fileId && targetEmail) {
        try {
          await drive.permissions.create({
            fileId: fileId,
            supportsAllDrives: true,
            requestBody: {
              role: "writer",
              type: "user",
              emailAddress: targetEmail,
            },
          })
        } catch (err) {
          // Sharing file permission optional
        }
      }

      uploadedCount++
    }

    return { uploadedCount }
  } catch (error: any) {
    console.error("Error in uploadFilesToDriveFolder:", error)
    throw new Error(
      error.message || "Failed to upload files to Google Drive folder."
    )
  }
}
