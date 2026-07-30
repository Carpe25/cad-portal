"use client"

import { useState } from "react"
import { Folder, Copy, Check, ExternalLink, Loader2 } from "lucide-react"

type Props = {
  path: string
  label?: string
  className?: string
}

export function FolderPathLink({ path, label, className = "" }: Props) {
  const [copied, setCopied] = useState(false)
  const [opening, setOpening] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)

  if (!path || !path.trim()) return null

  const cleanPath = path.trim()

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(cleanPath)
      setCopied(true)
      setStatusMessage("Copied path to clipboard!")
      setTimeout(() => {
        setCopied(false)
        setStatusMessage(null)
      }, 2500)
    } catch (err) {
      console.error("Failed to copy path:", err)
    }
  }

  const handleOpenFolder = async (e: React.MouseEvent) => {
    e.preventDefault()
    if (opening) return

    setOpening(true)
    setStatusMessage("Opening folder...")

    try {
      const res = await fetch("/api/open-folder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: cleanPath }),
      })

      const data = await res.json()

      if (res.ok && data.success) {
        setStatusMessage("Opened in File Explorer!")
      } else {
        // Fallback: If server open failed (e.g. running on remote cloud), copy to clipboard
        await navigator.clipboard.writeText(cleanPath).catch(() => {})
        setStatusMessage("Copied path (Paste in File Explorer)")
      }
    } catch (err) {
      console.error("Error calling open-folder API:", err)
      await navigator.clipboard.writeText(cleanPath).catch(() => {})
      setStatusMessage("Copied path (Paste in File Explorer)")
    } finally {
      setOpening(false)
      setTimeout(() => setStatusMessage(null), 3000)
    }
  }

  return (
    <div
      className={`group flex flex-col gap-1.5 rounded-lg border border-border/80 bg-muted/40 p-2.5 text-xs transition-colors hover:border-primary/40 hover:bg-muted/70 ${className}`}
    >
      {label && (
        <div className="flex items-center justify-between text-[11px] font-medium text-muted-foreground">
          <span>{label}</span>
          {statusMessage && (
            <span className="flex items-center gap-1 font-semibold text-primary">
              {copied ? <Check className="h-3 w-3 text-emerald-500" /> : null}
              {statusMessage}
            </span>
          )}
        </div>
      )}

      <div className="flex items-center gap-2">
        <Folder className="h-4 w-4 text-amber-500 shrink-0" />
        <button
          type="button"
          onClick={handleOpenFolder}
          disabled={opening}
          title={`Click to open folder: ${cleanPath}`}
          className="font-mono text-[11.5px] font-medium text-foreground underline decoration-muted-foreground/40 underline-offset-2 hover:text-primary hover:decoration-primary cursor-pointer truncate flex-1 text-left"
        >
          {cleanPath}
        </button>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={handleCopy}
            title="Copy path to clipboard"
            className="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground transition-colors cursor-pointer"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </button>

          <button
            type="button"
            onClick={handleOpenFolder}
            disabled={opening}
            title="Open folder in File Explorer"
            className="flex h-7 px-2 items-center gap-1 rounded-md border border-primary/20 bg-primary/10 text-primary font-medium hover:bg-primary hover:text-primary-foreground transition-colors cursor-pointer text-[11px] disabled:opacity-50"
          >
            {opening ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <>
                <span>Open</span>
                <ExternalLink className="h-3 w-3" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
