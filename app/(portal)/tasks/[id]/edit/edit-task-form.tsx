"use client"

import { useState, useTransition, ChangeEvent } from "react"
import { useRouter } from "next/navigation"
import { updateTaskAction } from "../actions"
import { createDriveFolderAction } from "@/app/(portal)/tasks/new/actions"
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
import { CalendarIcon, Image as ImageIcon, Sparkles, X, FolderPlus, Check, ArrowLeft, Save } from "lucide-react"
import Link from "next/link"
import { parseDeadlineDate } from "@/lib/task-utils"

const CATEGORIES = [
  { code: "RN", label: "Ring" },
  { code: "PN", label: "Pendant" },
  { code: "ER", label: "Earring" },
  { code: "NK", label: "Necklace" },
  { code: "OB", label: "Oval Bangel" },
  { code: "RB", label: "Round Bengel" },
  { code: "CH", label: "Charm" },
  { code: "BR", label: "Bracelet" },
  { code: "CF", label: "Cufflink" },
  { code: "BH", label: "Brooch" },
]

const CATEGORY_DEADLINE_HOURS: Record<string, number> = {
  RN: 24,
  PN: 24,
  ER: 36,
  NK: 56,
  OB: 72,
  RB: 72,
  CH: 24,
  BR: 48,
  CF: 24,
  BH: 24,
}

const COMPLEXITIES = ["A", "B", "C", "D"]
const SPEEDS = ["U", "N"]

function formatDateDDMMYYYY(date: Date): string {
  const day = String(date.getDate()).padStart(2, "0")
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const year = date.getFullYear()
  return `${day}-${month}-${year}`
}

function formatDateDDMMYYYYTime(date: Date): string {
  const day = String(date.getDate()).padStart(2, "0")
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const year = date.getFullYear()
  const hours = String(date.getHours()).padStart(2, "0")
  const mins = String(date.getMinutes()).padStart(2, "0")
  return `${day}-${month}-${year} ${hours}:${mins}`
}

function parseDateString(dateStr: string): Date {
  if (!dateStr) return new Date()
  const parts = dateStr.trim().split("-")
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10))
    } else if (parts[2].length === 4) {
      return new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10))
    }
  }
  const parsed = new Date(dateStr)
  return isNaN(parsed.getTime()) ? new Date() : parsed
}

function calculateDeadlineDate(categoryCode: string, baseDateStr?: string): string {
  const hours = CATEGORY_DEADLINE_HOURS[categoryCode] ?? 24
  let baseDate = new Date()
  if (baseDateStr) {
    const parsed = parseDateString(baseDateStr)
    const now = new Date()
    parsed.setHours(now.getHours(), now.getMinutes(), now.getSeconds())
    baseDate = parsed
  }
  const deadlineDate = new Date(baseDate.getTime() + hours * 60 * 60 * 1000)
  return formatDateDDMMYYYYTime(deadlineDate)
}

function formatDateForFolderName(dateStr: string): string {
  if (!dateStr) return ""
  const parts = dateStr.trim().split("-")
  if (parts.length !== 3) return dateStr
  let year = ""
  let monthIdx = 0
  let day = ""

  if (parts[0].length === 4) {
    year = parts[0].slice(-2)
    monthIdx = parseInt(parts[1], 10) - 1
    day = parts[2].padStart(2, "0")
  } else if (parts[2].length === 4) {
    year = parts[2].slice(-2)
    monthIdx = parseInt(parts[1], 10) - 1
    day = parts[0].padStart(2, "0")
  } else {
    return dateStr
  }

  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ]
  const monthName = months[monthIdx] || parts[1]
  return `${day}-${monthName}-${year}`
}

function formatInitialDateDisplay(d: string | null): string {
  if (!d) return formatDateDDMMYYYY(new Date())
  const parsed = parseDeadlineDate(d)
  if (!parsed || isNaN(parsed.getTime())) return formatDateDDMMYYYY(new Date())
  return formatDateDDMMYYYY(parsed)
}

export type TaskData = {
  id: string
  readable_id: string
  title: string
  client_name: string
  customer_project_no: string | null
  speed: string | null
  customer_code: string | null
  category_code: string | null
  complexity: string | null
  work_type: string | null
  version: string | null
  sr_no: string | null
  cd_project_no: string | null
  request_date: string | null
  reference_image: string | null
  style_ref_number: string | null
  description: string | null
  points: number
  status: string
  priority: string
  deadline: string | null
  drive_folder_link: string | null
  assigned_to: string | null
}

export function EditTaskForm({
  task,
  designers,
  customers = [],
}: {
  task: TaskData
  designers: { id: string; name: string }[]
  customers?: { uuid: string; code: string; name: string }[]
}) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // Initial reference images
  let existingImages: string[] = []
  if (task.reference_image) {
    try {
      const parsed = JSON.parse(task.reference_image)
      existingImages = Array.isArray(parsed) ? parsed : [task.reference_image]
    } catch (e) {
      existingImages = [task.reference_image]
    }
  }

  // Form field states
  const [cdProjectNo, setCdProjectNo] = useState(task.cd_project_no ?? "")
  const [customerProjectNo, setCustomerProjectNo] = useState(task.customer_project_no ?? "")
  const [speed, setSpeed] = useState(task.speed ?? "U")
  const [selectedCustomerCode, setSelectedCustomerCode] = useState(task.customer_code ?? (customers[0]?.code ?? "01"))
  const [clientName, setClientName] = useState(task.client_name ?? "")
  const [categoryCode, setCategoryCode] = useState(task.category_code ?? "RN")
  const [complexity, setComplexity] = useState(task.complexity ?? "A")
  const [workType, setWorkType] = useState<"New" | "Old">((task.work_type as "New" | "Old") ?? "New")
  const [versionInput, setVersionInput] = useState(task.version ?? "V1")
  const [requestDate, setRequestDate] = useState(() => formatInitialDateDisplay(task.request_date))
  const [deadline, setDeadline] = useState(() => formatInitialDateDisplay(task.deadline))

  const handleWorkTypeChange = (val: "New" | "Old") => {
    setWorkType(val)
    if (val === "New" && versionInput !== "V1") {
      setVersionInput("V1")
    }
  }

  // Standard task fields
  const [description, setDescription] = useState(task.description ?? "")
  const [points, setPoints] = useState(String(task.points ?? 0))
  const [driveLink, setDriveLink] = useState(task.drive_folder_link ?? "")
  const [priority, setPriority] = useState(task.priority ?? "medium")
  const [assignedTo, setAssignedTo] = useState(task.assigned_to ?? "")

  // Reference image files and previews state
  const [selectedImageFiles, setSelectedImageFiles] = useState<File[]>([])
  const [imagePreviews, setImagePreviews] = useState<string[]>([])

  // Proposed Google Drive folder name format
  const formattedDate = formatDateForFolderName(requestDate)
  const folderParts = [
    cdProjectNo.trim(),
    customerProjectNo.trim(),
    versionInput.trim(),
    formattedDate,
  ].filter(Boolean)
  const proposedFolderName = folderParts.join("_")

  const [isCreatingDriveFolder, setIsCreatingDriveFolder] = useState(false)
  const [driveFolderSuccess, setDriveFolderSuccess] = useState(false)

  const handleConnectToDrive = async () => {
    setError(null)
    setIsCreatingDriveFolder(true)
    setDriveFolderSuccess(false)
    try {
      const res = await createDriveFolderAction(proposedFolderName)
      if (res.error) {
        setError(res.error)
      } else if (res.folderUrl) {
        setDriveLink(res.folderUrl)
        setDriveFolderSuccess(true)
      }
    } catch (err: any) {
      setError(err.message || "Failed to create Google Drive folder.")
    } finally {
      setIsCreatingDriveFolder(false)
    }
  }

  const handleCustomerChange = (code: string) => {
    setSelectedCustomerCode(code)
    const cust = customers.find((c) => c.code === code)
    if (cust) {
      setClientName(cust.name)
    }
  }

  const handleCategoryChange = (code: string) => {
    setCategoryCode(code)
    setDeadline(calculateDeadlineDate(code, requestDate))
  }

  const handleRequestDateChange = (dateStr: string) => {
    setRequestDate(dateStr)
    setDeadline(calculateDeadlineDate(categoryCode, dateStr))
  }

  const handleImageChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return

    const newPreviews = files.map((file) => URL.createObjectURL(file))
    setSelectedImageFiles((prev) => [...prev, ...files])
    setImagePreviews((prev) => [...prev, ...newPreviews])
    e.target.value = ""
  }

  const removeImagePreview = (index: number) => {
    setSelectedImageFiles((prev) => prev.filter((_, i) => i !== index))
    setImagePreviews((prev) => prev.filter((_, i) => i !== index))
  }

  const [uploadStatus, setUploadStatus] = useState<string | null>(null)

  async function uploadReferenceImagesDirectly(files: File[]): Promise<string[]> {
    const uploadedUrls: string[] = []

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      setUploadStatus(`Uploading image ${i + 1} of ${files.length}...`)

      const presignedRes = await fetch("/api/tasks/reference-presigned-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          fileSize: file.size,
          contentType: file.type || "image/jpeg",
        }),
      })

      const presignedData = await presignedRes.json()

      if (!presignedRes.ok || !presignedData.success) {
        throw new Error(presignedData.error || `Failed to generate upload link for ${file.name}`)
      }

      if (presignedData.presignedUrl) {
        const uploadRes = await fetch(presignedData.presignedUrl, {
          method: "PUT",
          body: file,
          headers: {
            "Content-Type": file.type || "application/octet-stream",
          },
        })

        if (!uploadRes.ok) {
          throw new Error(`Direct storage upload failed for ${file.name} (HTTP ${uploadRes.status})`)
        }
        uploadedUrls.push(presignedData.fileUrl)
      } else if (presignedData.fileUrl) {
        uploadedUrls.push(presignedData.fileUrl)
      }
    }

    return uploadedUrls
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    startTransition(async () => {
      try {
        let uploadedUrls: string[] = []
        if (selectedImageFiles.length > 0) {
          uploadedUrls = await uploadReferenceImagesDirectly(selectedImageFiles)
        }

        setUploadStatus("Saving task changes...")

        const formData = new FormData()
        formData.append("customer_project_no", customerProjectNo)
        formData.append("speed", speed)
        formData.append("customer_code", selectedCustomerCode)
        formData.append("client_name", clientName)
        formData.append("category_code", categoryCode)
        formData.append("complexity", complexity)
        formData.append("work_type", workType)
        formData.append("version", versionInput)
        formData.append("sr_no", task.sr_no ?? "")
        formData.append("cd_project_no", cdProjectNo)
        formData.append("request_date", requestDate)
        formData.append("assigned_to", assignedTo === "unassigned" ? "" : assignedTo)
        formData.append("priority", speed === "U" ? "high" : priority)
        formData.append("description", description)
        formData.append("points", points)
        formData.append("deadline", deadline)
        formData.append("drive_folder_link", driveLink)

        uploadedUrls.forEach((url) => {
          formData.append("reference_image_url", url)
        })

        const result = await updateTaskAction(task.id, formData)
        if (result?.error) {
          setError(result.error)
        } else {
          router.push(`/tasks/${task.id}`)
        }
      } catch (err: any) {
        console.error("Task update error:", err)
        setError(err.message || "Failed to update task with uploaded images.")
      } finally {
        setUploadStatus(null)
      }
    })
  }


  return (
    <Card className="shadow-xs border-border">
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          {/* Header Banner */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-primary/20 bg-primary/5 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-xs">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-semibold tracking-wider text-primary uppercase">
                  Editing Task #{task.readable_id}
                </p>
                <p className="font-mono text-xl font-bold tracking-tight text-foreground">
                  {cdProjectNo || customerProjectNo || task.title}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {task.sr_no && (
                <Badge variant="outline" className="font-mono text-xs">
                  Sr. No: #{task.sr_no}
                </Badge>
              )}
              <Badge variant="secondary" className="bg-primary/10 text-primary font-semibold text-xs">
                {workType} ({versionInput})
              </Badge>
            </div>
          </div>

          {error && (
            <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-sm font-medium text-destructive">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {/* Customer Selection */}
            {customers.length > 0 ? (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="customer_code">Customer / Client</Label>
                <Select value={selectedCustomerCode} onValueChange={handleCustomerChange}>
                  <SelectTrigger id="customer_code">
                    <SelectValue placeholder="Select Customer" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map((c) => (
                      <SelectItem key={c.uuid} value={c.code}>
                        {c.code} - {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="client_name">Customer / Client Name</Label>
                <Input
                  id="client_name"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="Enter Client Name"
                  required
                />
              </div>
            )}

            {/* Customer Project No. */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="customer_project_no">Customer Project No.</Label>
              <Input
                id="customer_project_no"
                value={customerProjectNo}
                onChange={(e) => setCustomerProjectNo(e.target.value)}
                placeholder="e.g. CUST-101"
              />
            </div>

            {/* CD Project No. */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cd_project_no">CD Project No.</Label>
              <Input
                id="cd_project_no"
                value={cdProjectNo}
                onChange={(e) => setCdProjectNo(e.target.value)}
                placeholder="e.g. CD-2026-001"
              />
            </div>

            {/* Category */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="category_code">Category</Label>
              <Select value={categoryCode} onValueChange={handleCategoryChange}>
                <SelectTrigger id="category_code">
                  <SelectValue placeholder="Select Category" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat.code} value={cat.code}>
                      {cat.code} - {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Complexity */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="complexity">Complexity</Label>
              <Select value={complexity} onValueChange={setComplexity}>
                <SelectTrigger id="complexity">
                  <SelectValue placeholder="Select Complexity" />
                </SelectTrigger>
                <SelectContent>
                  {COMPLEXITIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      Complexity {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Speed (Urgency) */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="speed">Speed / Priority</Label>
              <Select value={speed} onValueChange={setSpeed}>
                <SelectTrigger id="speed">
                  <SelectValue placeholder="Select Speed" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="U">Urgent (U)</SelectItem>
                  <SelectItem value="N">Normal (N)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Work Type */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="work_type">Work Type</Label>
              <Select value={workType} onValueChange={(v) => handleWorkTypeChange(v as "New" | "Old")}>
                <SelectTrigger id="work_type">
                  <SelectValue placeholder="Select Work Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="New">New</SelectItem>
                  <SelectItem value="Old">Old (Revision/Update)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Version */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="version">Version</Label>
              <Input
                id="version"
                value={versionInput}
                onChange={(e) => setVersionInput(e.target.value)}
                placeholder="e.g. V1, V2"
              />
            </div>

            {/* Request Date */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="request_date">Request Date (DD-MM-YYYY)</Label>
              <Input
                id="request_date"
                value={requestDate}
                onChange={(e) => handleRequestDateChange(e.target.value)}
                placeholder="DD-MM-YYYY"
              />
            </div>

            {/* Deadline */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="deadline">Deadline (DD-MM-YYYY)</Label>
              <Input
                id="deadline"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                placeholder="DD-MM-YYYY"
              />
            </div>

            {/* Assigned Designer */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="assigned_to">Assigned Designer</Label>
              <Select value={assignedTo} onValueChange={setAssignedTo}>
                <SelectTrigger id="assigned_to">
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {designers.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Points */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="points">Points</Label>
              <Input
                id="points"
                type="number"
                step="0.5"
                value={points}
                onChange={(e) => setPoints(e.target.value)}
                placeholder="0"
              />
            </div>
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="description">Task Description / Instructions</Label>
            <Textarea
              id="description"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide instructions or scope for this CAD design task..."
            />
          </div>

          {/* Google Drive Link Section */}
          <div className="flex flex-col gap-2 rounded-lg border border-border p-4 bg-muted/20">
            <Label htmlFor="drive_folder_link">Google Drive Folder Link</Label>
            <div className="flex gap-2">
              <Input
                id="drive_folder_link"
                value={driveLink}
                onChange={(e) => setDriveLink(e.target.value)}
                placeholder="https://drive.google.com/..."
                className="flex-1 font-mono text-xs"
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={isCreatingDriveFolder || !proposedFolderName}
                onClick={handleConnectToDrive}
                className="shrink-0 gap-1.5"
              >
                {driveFolderSuccess ? (
                  <>
                    <Check className="h-4 w-4 text-emerald-600" />
                    Connected
                  </>
                ) : (
                  <>
                    <FolderPlus className="h-4 w-4" />
                    {isCreatingDriveFolder ? "Creating..." : "Create Drive Folder"}
                  </>
                )}
              </Button>
            </div>
            {proposedFolderName && (
              <p className="text-[11px] text-muted-foreground font-mono">
                Folder Name: <span className="text-foreground">{proposedFolderName}</span>
              </p>
            )}
          </div>

          {/* Existing & New Reference Images */}
          <div className="flex flex-col gap-2">
            <Label>Reference Images</Label>

            {existingImages.length > 0 && (
              <div className="mb-2">
                <p className="text-xs text-muted-foreground mb-1.5">Current Reference Images:</p>
                <div className="flex flex-wrap gap-2">
                  {existingImages.map((src, idx) => (
                    <div key={idx} className="relative h-20 w-20 overflow-hidden rounded-md border border-border bg-muted">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={src} alt={`Reference ${idx + 1}`} className="h-full w-full object-cover" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center gap-4">
              <Input
                id="reference_image"
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageChange}
                className="cursor-pointer"
              />
            </div>

            {imagePreviews.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-3">
                {imagePreviews.map((preview, index) => (
                  <div key={index} className="relative h-20 w-20 overflow-hidden rounded-md border border-border">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={preview} alt="New upload preview" className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeImagePreview(index)}
                      className="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-background/80 text-foreground hover:bg-destructive hover:text-white"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-3 border-t border-border pt-4">
            <Button variant="outline" asChild>
              <Link href={`/tasks/${task.id}`}>
                <ArrowLeft className="mr-1.5 h-4 w-4" />
                Cancel
              </Link>
            </Button>
            <Button type="submit" disabled={isPending} className="gap-2">
              <Save className="h-4 w-4" />
              {isPending ? (uploadStatus || "Saving Changes...") : "Save Task Changes"}
            </Button>

          </div>
        </form>
      </CardContent>
    </Card>
  )
}
