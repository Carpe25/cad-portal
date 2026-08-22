export type DeliverableItem = {
  id: string
  label: string
  required: boolean
}

export const DEFAULT_DELIVERABLES: DeliverableItem[] = [
  { id: "3dm", label: "3dm", required: true },
  { id: "render_3dm", label: "render 3dm", required: true },
  { id: "production_stl", label: "production stl", required: true },
  { id: "ijewel_rendering", label: "ijewel rendering", required: true },
  { id: "quotation_image", label: "quotation image", required: true },
  { id: "production_image", label: "production image", required: true },
]

export function parseDeliverables(raw: string | null | undefined): DeliverableItem[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (item) => item && typeof item.label === "string" && item.label.trim()
    )
  } catch {
    return []
  }
}

export function serializeDeliverables(items: DeliverableItem[]): string {
  return JSON.stringify(items)
}
