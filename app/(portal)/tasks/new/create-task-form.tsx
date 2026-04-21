"use client"

import { useState, useTransition, useRef, useCallback } from "react"
import { createTaskAction } from "./actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"

/* ------------------------------------------------------------------ */
/*  Types for the parsed Trello card data                              */
/* ------------------------------------------------------------------ */
interface TrelloLabel {
  id: string
  name: string
  color: string
}

interface TrelloMember {
  id: string
  fullName: string
  username: string
  avatarUrl?: string | null
}

interface TrelloCheckItem {
  id: string
  name: string
  state: string
}

interface TrelloChecklist {
  id: string
  name: string
  checkItems: TrelloCheckItem[]
}

interface TrelloCustomField {
  id: string
  fieldName: string
  fieldType: string
  value: string | null
}

interface TrelloAttachment {
  id: string
  name: string
  url: string
  date: string
}

interface ParsedTrelloCard {
  id: string
  name: string
  desc: string
  due: string | null
  dueComplete: boolean
  dateLastActivity: string | null
  closed: boolean
  url: string
  shortUrl: string
  labels: TrelloLabel[]
  boardName: string | null
  listName: string | null
  members: TrelloMember[]
  checklists: TrelloChecklist[]
  customFields: TrelloCustomField[]
  attachments: TrelloAttachment[]
}

/* ------------------------------------------------------------------ */
/*  Parser: Trello JSON → ParsedTrelloCard                             */
/* ------------------------------------------------------------------ */
function parseTrelloJson(raw: Record<string, unknown>): ParsedTrelloCard {
  const json = raw as Record<string, any>

  /* --- Board & list names from actions (skip commentCard) --- */
  let boardName: string | null = null
  let listName: string | null = null

  const actions: any[] = Array.isArray(json.actions) ? json.actions : []
  for (const action of actions) {
    if (action.type === "commentCard") continue
    const data = action.data ?? {}
    if (!boardName && data.board?.name) boardName = data.board.name
    if (!listName) {
      if (data.listAfter?.name) {
        listName = data.listAfter.name
        break
      }
      if (data.list?.name) {
        listName = data.list.name
      }
    }
  }

  /* --- Labels --- */
  const labels: TrelloLabel[] = (json.labels ?? []).map((l: any) => ({
    id: l.id,
    name: l.name || l.color || "Unlabelled",
    color: l.color ?? "gray",
  }))

  /* --- Members --- */
  const members: TrelloMember[] = (json.members ?? []).map((m: any) => ({
    id: m.id,
    fullName: m.fullName ?? m.username ?? "Unknown",
    username: m.username ?? "",
    avatarUrl: m.avatarUrl ?? null,
  }))

  /* --- Checklists --- */
  const checklists: TrelloChecklist[] = (json.checklists ?? []).map(
    (cl: any) => ({
      id: cl.id,
      name: cl.name,
      checkItems: (cl.checkItems ?? []).map((ci: any) => ({
        id: ci.id,
        name: ci.name,
        state: ci.state,
      })),
    })
  )

  /* --- Custom field items --- */
  const customFields: TrelloCustomField[] = []
  const cfItems: any[] = json.customFieldItems ?? []

  for (const cfi of cfItems) {
    // Try to resolve name from the actions history
    let fieldName = cfi.idCustomField
    let fieldType = "unknown"
    let value: string | null = null

    // Search actions for updateCustomFieldItem to find name/value
    for (const action of actions) {
      if (
        action.type === "updateCustomFieldItem" &&
        action.data?.customField?.id === cfi.idCustomField
      ) {
        fieldName = action.data.customField.name ?? fieldName
        fieldType = action.data.customField.type ?? fieldType
        break
      }
    }

    // Resolve value
    if (cfi.value) {
      if (cfi.value.text) value = cfi.value.text
      else if (cfi.value.number) value = cfi.value.number
      else if (cfi.value.date) value = cfi.value.date
      else if (cfi.value.checked !== undefined)
        value = cfi.value.checked ? "Yes" : "No"
      else value = JSON.stringify(cfi.value)
    } else if (cfi.idValue) {
      // List-type custom field — show value ID (actual option name not in card export)
      value = `Option: ${cfi.idValue}`
    }

    customFields.push({ id: cfi.id, fieldName, fieldType, value })
  }

  /* --- Attachments (from actions, skip commentCard) --- */
  const attachments: TrelloAttachment[] = []
  const seenAttachments = new Set<string>()
  for (const action of actions) {
    if (action.type === "commentCard") continue
    if (action.type === "addAttachmentToCard" && action.data?.attachment) {
      const att = action.data.attachment
      if (!seenAttachments.has(att.id)) {
        seenAttachments.add(att.id)
        attachments.push({
          id: att.id,
          name: att.name,
          url: att.url,
          date: action.date,
        })
      }
    }
  }

  return {
    id: json.id ?? "",
    name: json.name ?? "",
    desc: json.desc ?? "",
    due: json.due ?? null,
    dueComplete: json.dueComplete ?? false,
    dateLastActivity: json.dateLastActivity ?? null,
    closed: json.closed ?? false,
    url: json.url ?? "",
    shortUrl: json.shortUrl ?? "",
    labels,
    boardName,
    listName,
    members,
    checklists,
    customFields,
    attachments,
  }
}

/* ------------------------------------------------------------------ */
/*  Colour helpers for Trello label badges                             */
/* ------------------------------------------------------------------ */
const LABEL_COLORS: Record<string, string> = {
  green: "bg-emerald-600/15 text-emerald-700 dark:text-emerald-400",
  yellow: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  orange: "bg-orange-500/15 text-orange-700 dark:text-orange-400",
  red: "bg-red-500/15 text-red-700 dark:text-red-400",
  purple: "bg-violet-500/15 text-violet-700 dark:text-violet-400",
  blue: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  sky: "bg-sky-500/15 text-sky-700 dark:text-sky-400",
  lime: "bg-lime-500/15 text-lime-700 dark:text-lime-400",
  pink: "bg-pink-500/15 text-pink-700 dark:text-pink-400",
  black: "bg-zinc-800/15 text-zinc-700 dark:text-zinc-300",
}

function labelBadgeClass(color: string) {
  return LABEL_COLORS[color] ?? "bg-muted text-muted-foreground"
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */
export function CreateTaskForm({
  designers,
}: {
  designers: { id: string; name: string }[]
}) {
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [assignedTo, setAssignedTo] = useState("")

  // Trello import state
  const [trelloData, setTrelloData] = useState<ParsedTrelloCard | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  /* ---------- Form field state (populated from Trello or manual) ---- */
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [deadline, setDeadline] = useState("")
  const [clientName, setClientName] = useState("")
  const [styleRef, setStyleRef] = useState("")
  const [points, setPoints] = useState("")
  const [driveLink, setDriveLink] = useState("")

  /* ---------- Handle Trello JSON file ---- */
  const processTrelloFile = useCallback(
    (file: File) => {
      setImportError(null)
      if (file.type !== "application/json" && !file.name.endsWith(".json")) {
        setImportError("Please upload a valid JSON file.")
        return
      }

      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const raw = JSON.parse(e.target?.result as string)

          // Basic validation: check for expected Trello card fields
          if (!raw.id || !raw.name || !raw.actions) {
            setImportError(
              "This doesn't look like a Trello card JSON export. Missing required fields."
            )
            return
          }

          const parsed = parseTrelloJson(raw)
          setTrelloData(parsed)

          // Populate form fields
          setTitle(parsed.name)
          setDescription(parsed.desc)
          if (parsed.due) {
            setDeadline(parsed.due.split("T")[0])
          }
          // Try to extract client name from the card name pattern "X - Client - Ref"
          const nameParts = parsed.name.split(" - ")
          if (nameParts.length >= 2) {
            setClientName(nameParts.slice(0, -1).join(" - ").trim())
            setStyleRef(nameParts[nameParts.length - 1]?.trim() || "")
          } else {
            setClientName(parsed.name)
          }
        } catch {
          setImportError("Failed to parse JSON file. Please check the format.")
        }
      }
      reader.readAsText(file)
    },
    []
  )

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processTrelloFile(file)
  }

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      const file = e.dataTransfer.files?.[0]
      if (file) processTrelloFile(file)
    },
    [processTrelloFile]
  )

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => setIsDragging(false)

  const clearTrelloImport = () => {
    setTrelloData(null)
    setImportError(null)
    setTitle("")
    setDescription("")
    setDeadline("")
    setClientName("")
    setStyleRef("")
    setPoints("")
    setDriveLink("")
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  /* ---------- Submit ---- */
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const formData = new FormData(e.currentTarget)
    formData.set("assigned_to", assignedTo)
    startTransition(async () => {
      const result = await createTaskAction(formData)
      if (result?.error) setError(result.error)
    })
  }

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      {/* ------------------------------------------------------------ */}
      {/*  Trello JSON Upload Zone                                      */}
      {/* ------------------------------------------------------------ */}
      <Card className="shadow-xs border-dashed">
        <CardContent className="pt-6">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold leading-none">
                  Import from Trello
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Upload a Trello card JSON export to auto-fill the form.
                </p>
              </div>
              {trelloData && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={clearTrelloImport}
                  className="text-xs h-7"
                >
                  Clear Import
                </Button>
              )}
            </div>

            {/* Drop zone */}
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => fileInputRef.current?.click()}
              className={`
                relative flex flex-col items-center justify-center gap-2
                rounded-lg border-2 border-dashed p-6 cursor-pointer
                transition-all duration-200 ease-in-out
                ${
                  isDragging
                    ? "border-primary bg-primary/5 scale-[1.01]"
                    : trelloData
                      ? "border-emerald-500/50 bg-emerald-500/5"
                      : "border-muted-foreground/25 hover:border-muted-foreground/40 hover:bg-muted/30"
                }
              `}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={handleFileChange}
                className="hidden"
              />

              {trelloData ? (
                <div className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400">
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <span className="font-medium">
                    Imported: {trelloData.name}
                  </span>
                </div>
              ) : (
                <>
                  <svg
                    className="h-8 w-8 text-muted-foreground/50"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m6.75 12l-3-3m0 0l-3 3m3-3v6m-1.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
                    />
                  </svg>
                  <p className="text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">
                      Click to upload
                    </span>{" "}
                    or drag & drop
                  </p>
                  <p className="text-xs text-muted-foreground/70">
                    Trello card JSON export only
                  </p>
                </>
              )}
            </div>

            {importError && (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {importError}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ------------------------------------------------------------ */}
      {/*  Main Form                                                    */}
      {/* ------------------------------------------------------------ */}
      <Card className="shadow-xs">
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            {/* Title */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="title">Task Title *</Label>
              <Input
                id="title"
                name="title"
                placeholder="e.g. Living Room Layout - Johnson"
                required
                disabled={isPending}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            {/* Client Name + Style Ref */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="client_name">Client Name *</Label>
                <Input
                  id="client_name"
                  name="client_name"
                  placeholder="e.g. Johnson & Co."
                  required
                  disabled={isPending}
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="style_ref_number">Style / Ref Number</Label>
                <Input
                  id="style_ref_number"
                  name="style_ref_number"
                  placeholder="e.g. STY-2024-089"
                  disabled={isPending}
                  value={styleRef}
                  onChange={(e) => setStyleRef(e.target.value)}
                />
              </div>
            </div>

            {/* Description */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                name="description"
                placeholder="Describe the scope, dimensions, style notes..."
                rows={4}
                disabled={isPending}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            {/* Points + Deadline */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="points">Points *</Label>
                <Input
                  id="points"
                  name="points"
                  type="number"
                  min={1}
                  placeholder="e.g. 10"
                  required
                  disabled={isPending}
                  value={points}
                  onChange={(e) => setPoints(e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="deadline">Deadline</Label>
                <Input
                  id="deadline"
                  name="deadline"
                  type="date"
                  disabled={isPending}
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                />
              </div>
            </div>

            {/* Drive Folder Link */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="drive_folder_link">
                Google Drive Folder Link
              </Label>
              <Input
                id="drive_folder_link"
                name="drive_folder_link"
                placeholder="https://drive.google.com/drive/folders/..."
                disabled={isPending}
                value={driveLink}
                onChange={(e) => setDriveLink(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Paste the task folder link from your CAD drive. Files will be
                previewed inline.
              </p>
            </div>

            {/* Assign to Designer */}
            <div className="flex flex-col gap-1.5">
              <Label>Assign to Designer</Label>
              <Select
                value={assignedTo}
                onValueChange={setAssignedTo}
                disabled={isPending}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a designer…" />
                </SelectTrigger>
                <SelectContent>
                  {designers.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* ======================================================== */}
            {/*  TRELLO IMPORT DETAILS — shown only when data is loaded   */}
            {/* ======================================================== */}
            {trelloData && (
              <>
                <Separator className="my-1" />
                <div className="flex flex-col gap-4">
                  <h4 className="text-sm font-semibold text-muted-foreground tracking-wide uppercase">
                    Trello Card Details
                  </h4>

                  {/* Board + List */}
                  <div className="grid grid-cols-2 gap-4">
                    {trelloData.boardName && (
                      <div className="flex flex-col gap-1.5">
                        <Label className="text-xs text-muted-foreground">
                          Board
                        </Label>
                        <p className="text-sm font-medium">
                          {trelloData.boardName}
                        </p>
                      </div>
                    )}
                    {trelloData.listName && (
                      <div className="flex flex-col gap-1.5">
                        <Label className="text-xs text-muted-foreground">
                          Current List
                        </Label>
                        <p className="text-sm font-medium">
                          {trelloData.listName}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Status */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <Label className="text-xs text-muted-foreground">
                        Card Status
                      </Label>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="secondary"
                          className={
                            trelloData.closed
                              ? "bg-zinc-500/15 text-zinc-600"
                              : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                          }
                        >
                          {trelloData.closed ? "Archived" : "Open"}
                        </Badge>
                        {trelloData.dueComplete && (
                          <Badge
                            variant="secondary"
                            className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                          >
                            Due Complete
                          </Badge>
                        )}
                      </div>
                    </div>
                    {trelloData.dateLastActivity && (
                      <div className="flex flex-col gap-1.5">
                        <Label className="text-xs text-muted-foreground">
                          Last Activity
                        </Label>
                        <p className="text-sm">
                          {new Date(
                            trelloData.dateLastActivity
                          ).toLocaleDateString("en-US", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Labels */}
                  {trelloData.labels.length > 0 && (
                    <div className="flex flex-col gap-1.5">
                      <Label className="text-xs text-muted-foreground">
                        Labels
                      </Label>
                      <div className="flex flex-wrap gap-1.5">
                        {trelloData.labels.map((label) => (
                          <Badge
                            key={label.id}
                            variant="secondary"
                            className={labelBadgeClass(label.color)}
                          >
                            {label.name}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Members */}
                  {trelloData.members.length > 0 && (
                    <div className="flex flex-col gap-1.5">
                      <Label className="text-xs text-muted-foreground">
                        Members
                      </Label>
                      <div className="flex flex-wrap gap-2">
                        {trelloData.members.map((m) => (
                          <div
                            key={m.id}
                            className="flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 text-xs"
                          >
                            <div className="h-5 w-5 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-semibold text-primary">
                              {m.fullName
                                .split(" ")
                                .map((n) => n[0])
                                .join("")
                                .slice(0, 2)
                                .toUpperCase()}
                            </div>
                            <span>{m.fullName}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Custom Fields */}
                  {trelloData.customFields.length > 0 && (
                    <div className="flex flex-col gap-1.5">
                      <Label className="text-xs text-muted-foreground">
                        Custom Fields
                      </Label>
                      <div className="grid grid-cols-2 gap-3">
                        {trelloData.customFields.map((cf) => (
                          <div
                            key={cf.id}
                            className="rounded-md border bg-muted/30 px-3 py-2"
                          >
                            <p className="text-xs text-muted-foreground font-medium">
                              {cf.fieldName}
                            </p>
                            <p className="text-sm mt-0.5">
                              {cf.value || "—"}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Checklists */}
                  {trelloData.checklists.length > 0 && (
                    <div className="flex flex-col gap-2">
                      <Label className="text-xs text-muted-foreground">
                        Checklists
                      </Label>
                      {trelloData.checklists.map((cl) => (
                        <div
                          key={cl.id}
                          className="rounded-md border bg-muted/30 px-3 py-2"
                        >
                          <p className="text-xs font-semibold mb-1.5">
                            {cl.name}
                          </p>
                          <ul className="space-y-1">
                            {cl.checkItems.map((ci) => (
                              <li
                                key={ci.id}
                                className="flex items-center gap-2 text-xs"
                              >
                                <span
                                  className={`inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border ${
                                    ci.state === "complete"
                                      ? "bg-emerald-500 border-emerald-500 text-white"
                                      : "border-muted-foreground/30"
                                  }`}
                                >
                                  {ci.state === "complete" && (
                                    <svg
                                      className="h-2.5 w-2.5"
                                      fill="none"
                                      viewBox="0 0 24 24"
                                      strokeWidth={3}
                                      stroke="currentColor"
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        d="M4.5 12.75l6 6 9-13.5"
                                      />
                                    </svg>
                                  )}
                                </span>
                                <span
                                  className={
                                    ci.state === "complete"
                                      ? "line-through text-muted-foreground"
                                      : ""
                                  }
                                >
                                  {ci.name}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Attachments */}
                  {trelloData.attachments.length > 0 && (
                    <div className="flex flex-col gap-1.5">
                      <Label className="text-xs text-muted-foreground">
                        Attachments ({trelloData.attachments.length})
                      </Label>
                      <div className="space-y-1.5">
                        {trelloData.attachments.map((att) => (
                          <a
                            key={att.id}
                            href={att.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-xs hover:bg-muted/60 transition-colors"
                          >
                            <svg
                              className="h-4 w-4 text-muted-foreground shrink-0"
                              fill="none"
                              viewBox="0 0 24 24"
                              strokeWidth={1.5}
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13"
                              />
                            </svg>
                            <span className="truncate text-primary font-medium">
                              {att.name}
                            </span>
                            <span className="ml-auto text-muted-foreground shrink-0">
                              {new Date(att.date).toLocaleDateString()}
                            </span>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Trello Link */}
                  {trelloData.url && (
                    <div className="flex flex-col gap-1.5">
                      <Label className="text-xs text-muted-foreground">
                        Trello Card Link
                      </Label>
                      <a
                        href={trelloData.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary hover:underline truncate"
                      >
                        {trelloData.url}
                      </a>
                    </div>
                  )}
                </div>
              </>
            )}

            {error && (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}

            <div className="flex gap-3 pt-1">
              <Button type="submit" disabled={isPending}>
                {isPending ? "Creating…" : "Create Task"}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={isPending}
                onClick={() => window.history.back()}
              >
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
