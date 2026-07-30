"use client"

import { useState } from "react"
import { Folder, Copy, Check, ExternalLink, Loader2, Download, HelpCircle } from "lucide-react"

type Props = {
  path: string
  label?: string
  className?: string
}

export function FolderPathLink({ path, label, className = "" }: Props) {
  const [copied, setCopied] = useState(false)
  const [opening, setOpening] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [showProdHelp, setShowProdHelp] = useState(false)

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
      // 1. Try server API route (works when server is running on local network / machine)
      const res = await fetch("/api/open-folder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: cleanPath }),
      })

      const data = await res.json()

      if (res.ok && data.success) {
        setStatusMessage("Opened in File Explorer!")
        setOpening(false)
        setTimeout(() => setStatusMessage(null), 3000)
        return
      }
    } catch (err) {
      console.error("Error calling local open-folder API:", err)
    }

    // 2. Production fallback: Try custom protocol openfolder:
    try {
      const openFolderUrl = `openfolder:${encodeURIComponent(cleanPath)}`
      window.location.href = openFolderUrl
      setStatusMessage("Opening File Explorer...")
    } catch (err) {
      console.error("Failed to trigger openfolder protocol:", err)
    }

    // 3. Fallback: Copy path to clipboard & show help hint
    try {
      await navigator.clipboard.writeText(cleanPath)
      setStatusMessage("Path copied! (Paste in File Explorer)")
      setShowProdHelp(true)
    } catch {}

    setOpening(false)
    setTimeout(() => setStatusMessage(null), 4000)
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

          <a
            href="/api/download-reg"
            title="Setup 1-Click Folder Open on Windows PC"
            className="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground transition-colors cursor-pointer"
          >
            <Download className="h-3.5 w-3.5 text-muted-foreground" />
          </a>
        </div>
      </div>

      {showProdHelp && (
        <div className="mt-1 flex items-center justify-between rounded bg-amber-500/10 px-2.5 py-1.5 text-[10.5px] text-amber-700 dark:text-amber-300">
          <span className="flex items-center gap-1">
            <HelpCircle className="h-3 w-3 shrink-0 text-amber-500" />
            <span>Path copied! Paste in File Explorer (`Win + R`) or download 1-click Windows setup.</span>
          </span>
          <a
            href="/api/download-reg"
            className="font-semibold text-primary underline underline-offset-2 hover:text-primary/80 shrink-0 ml-2"
          >
            Download Setup (.reg)
          </a>
        </div>
      )}
    </div>
  )
}
