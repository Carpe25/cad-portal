"use client"

export function DriveLink({ href }: { href: string }) {
  if (!href) return null

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        window.open(href, "_blank", "noopener,noreferrer")
      }}
      className="text-xs font-medium text-primary hover:underline cursor-pointer"
    >
      Open CAD →
    </button>
  )
}
