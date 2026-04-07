export function extractDriveFolderId(url: string): string | null {
  const match = url.match(/\/folders\/([a-zA-Z0-9_-]+)/)
  return match ? match[1] : null
}

export function getDriveEmbedUrl(folderId: string): string {
  return `https://drive.google.com/embeddedfolderview?id=${folderId}#list`
}
