"use client"

export function DriveLink({ href }: { href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="text-xs text-primary hover:underline"
    >
      Open CAD →
    </a>
  )
}
