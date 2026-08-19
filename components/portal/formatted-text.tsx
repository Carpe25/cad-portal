"use client"

import React from "react"

export function FormattedTextWithLinks({
  text,
  className = "whitespace-pre-wrap font-sans",
}: {
  text: string | null | undefined
  className?: string
}) {
  if (!text) return null

  // Regex to match URLs starting with http://, https://, or www.
  const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi
  const parts = text.split(urlRegex)

  return (
    <span className={className}>
      {parts.map((part, index) => {
        if (/^(https?:\/\/|www\.)/i.test(part)) {
          let cleanUrl = part
          let trailingPunctuation = ""
          const matchPunct = cleanUrl.match(/[.,;)]+$/)
          if (matchPunct) {
            trailingPunctuation = matchPunct[0]
            cleanUrl = cleanUrl.slice(0, -trailingPunctuation.length)
          }

          const href = cleanUrl.toLowerCase().startsWith("www.")
            ? `https://${cleanUrl}`
            : cleanUrl

          return (
            <React.Fragment key={index}>
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary font-medium underline underline-offset-2 hover:opacity-80 break-all"
                onClick={(e) => e.stopPropagation()}
              >
                {cleanUrl}
              </a>
              {trailingPunctuation}
            </React.Fragment>
          )
        }
        return part
      })}
    </span>
  )
}
