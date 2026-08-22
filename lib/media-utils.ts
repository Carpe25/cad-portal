export type MediaKind = "image" | "video" | "audio" | "other"

const IMAGE_EXT = [".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg", ".bmp"]
const VIDEO_EXT = [".mp4", ".webm", ".mov", ".m4v", ".avi", ".mkv"]
const AUDIO_EXT = [".mp3", ".wav", ".ogg", ".m4a", ".aac", ".flac"]

export function getMediaKind(filename: string): MediaKind {
  const lower = filename.toLowerCase()
  if (IMAGE_EXT.some((ext) => lower.endsWith(ext))) return "image"
  if (VIDEO_EXT.some((ext) => lower.endsWith(ext))) return "video"
  if (AUDIO_EXT.some((ext) => lower.endsWith(ext))) return "audio"
  return "other"
}

export function canPreviewMedia(filename: string): boolean {
  return getMediaKind(filename) !== "other"
}
