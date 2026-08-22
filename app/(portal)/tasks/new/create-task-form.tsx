"use client"

import { useState, useTransition, useEffect, ChangeEvent, DragEvent } from "react"
import { createTaskAction, createDriveFolderAction } from "./actions"
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
import { CalendarIcon, Image as ImageIcon, Sparkles, X, FolderPlus, Check, Upload, Plus, Trash2 } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DEFAULT_DELIVERABLES,
  serializeDeliverables,
  type DeliverableItem,
} from "@/lib/deliverables"



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
  RN: 24, // Ring - 24hrs
  PN: 24, // Pendant - 24 hrs
  ER: 36, // Earring - 36 hrs
  NK: 56, // Necklace - 56 hrs
  OB: 72, // Oval Bangel - 72hrs
  RB: 72, // Round Bengel - 72hrs
  CH: 24, // Charm - 24 hrs
  BR: 48, // Bracelet - 48 hrs
  CF: 24, // Cufflink - 24 hrs
  BH: 24, // Brooch - 24hrs
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
      // YYYY-MM-DD
      return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10))
    } else if (parts[2].length === 4) {
      // DD-MM-YYYY
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
    // YYYY-MM-DD
    year = parts[0].slice(-2)
    monthIdx = parseInt(parts[1], 10) - 1
    day = parts[2].padStart(2, "0")
  } else if (parts[2].length === 4) {
    // DD-MM-YYYY
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

export function CreateTaskForm({
  designers,
  customers = [],
  nextSrNoCount = 1,
}: {
  designers: { id: string; name: string }[]
  customers?: { uuid: string; code: string; name: string }[]
  nextSrNoCount?: number
}) {
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // Form field states
  const [cdProjectNo, setCdProjectNo] = useState("")
  const [customerProjectNo, setCustomerProjectNo] = useState("")
  const [speed, setSpeed] = useState("U")
  const [selectedCustomerCode, setSelectedCustomerCode] = useState(
    customers[0]?.code ?? "01"
  )
  const [clientName, setClientName] = useState(customers[0]?.name ?? "")
  const [categoryCode, setCategoryCode] = useState("RN")
  const [complexity, setComplexity] = useState("A")
  const [workType, setWorkType] = useState<"New" | "Old">("New")
  const [versionInput, setVersionInput] = useState("V1")
  const [requestDate, setRequestDate] = useState(() =>
    formatDateDDMMYYYY(new Date())
  )

  // Auto-calculated deadline based on initial category "RN" (24 hrs)
  const [deadline, setDeadline] = useState(() =>
    calculateDeadlineDate("RN", formatDateDDMMYYYY(new Date()))
  )

  // Handle Work Type change
  const handleWorkTypeChange = (val: "New" | "Old") => {
    setWorkType(val)
    setVersionInput(val === "New" ? "V1" : "V2")
  }

  // Standard task fields
  const [description, setDescription] = useState("")
  const [points, setPoints] = useState("")
  const [driveLink, setDriveLink] = useState("")
  const [priority, setPriority] = useState("medium")
  const [assignedTo, setAssignedTo] = useState("")

  // Reference image files — client vs self
  const [clientImageFiles, setClientImageFiles] = useState<File[]>([])
  const [clientImagePreviews, setClientImagePreviews] = useState<string[]>([])
  const [selfImageFiles, setSelfImageFiles] = useState<File[]>([])
  const [selfImagePreviews, setSelfImagePreviews] = useState<string[]>([])

  // Deliverables checklist
  const [deliverables, setDeliverables] = useState<DeliverableItem[]>(
    DEFAULT_DELIVERABLES.map((d) => ({ ...d }))
  )
  const [newDeliverableLabel, setNewDeliverableLabel] = useState("")

  // Sr. No. (4 digits e.g. 0001)
  const srNoFormatted = String(nextSrNoCount).padStart(4, "0")

  // Proposed Google Drive folder name format
  const formattedDate = formatDateForFolderName(requestDate)
  const folderParts = [
    cdProjectNo.trim(),
    customerProjectNo.trim(),
    versionInput.trim(),
    formattedDate,
  ].filter(Boolean)

  const proposedFolderName = folderParts.join("_")

  // Google Drive folder creation state
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

  // Update customer when selection changes
  const handleCustomerChange = (code: string) => {
    setSelectedCustomerCode(code)
    const cust = customers.find((c) => c.code === code)
    if (cust) {
      setClientName(cust.name)
    }
  }

  // Handle Category change & update deadline automatically
  const handleCategoryChange = (code: string) => {
    setCategoryCode(code)
    setDeadline(calculateDeadlineDate(code, requestDate))
  }

  // Handle Request Date change & recalculate deadline
  const handleRequestDateChange = (dateStr: string) => {
    setRequestDate(dateStr)
    setDeadline(calculateDeadlineDate(categoryCode, dateStr))
  }

  // Handle reference images selection (multiple)
  // Blob previews only render for images; other file types show a name chip
  const previewOf = (file: File) =>
    file.type.startsWith("image/") ? URL.createObjectURL(file) : ""

  const handleImageChange = (
    e: ChangeEvent<HTMLInputElement>,
    type: "client" | "self"
  ) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return

    const newPreviews = files.map((file) => previewOf(file))
    if (type === "client") {
      setClientImageFiles((prev) => [...prev, ...files])
      setClientImagePreviews((prev) => [...prev, ...newPreviews])
    } else {
      setSelfImageFiles((prev) => [...prev, ...files])
      setSelfImagePreviews((prev) => [...prev, ...newPreviews])
    }
    e.target.value = ""
  }

  const removeImagePreview = (index: number, type: "client" | "self") => {
    if (type === "client") {
      setClientImageFiles((prev) => prev.filter((_, i) => i !== index))
      setClientImagePreviews((prev) => prev.filter((_, i) => i !== index))
    } else {
      setSelfImageFiles((prev) => prev.filter((_, i) => i !== index))
      setSelfImagePreviews((prev) => prev.filter((_, i) => i !== index))
    }
  }

  const addDeliverable = () => {
    const label = newDeliverableLabel.trim()
    if (!label) return
    const id = `custom_${Date.now()}`
    setDeliverables((prev) => [...prev, { id, label, required: false }])
    setNewDeliverableLabel("")
  }

  const updateDeliverable = (id: string, patch: Partial<DeliverableItem>) => {
    setDeliverables((prev) =>
      prev.map((d) => (d.id === id ? { ...d, ...patch } : d))
    )
  }

  const removeDeliverable = (id: string) => {
    setDeliverables((prev) => prev.filter((d) => d.id !== id))
  }

  // Auto generate Project No based on Speed, Customer Code, Category Code, Serial No, Version
  useEffect(() => {
    setCdProjectNo(`${speed}${selectedCustomerCode}${categoryCode}${srNoFormatted}${versionInput}`)
  }, [speed, selectedCustomerCode, categoryCode, srNoFormatted, versionInput])

  // Drag and drop state for reference images
  const [isDragging, setIsDragging] = useState(false)

  const handleDragOver = (e: DragEvent<HTMLElement>) => {
    e.preventDefault()
    e.stopPropagation()
    if (!isDragging) setIsDragging(true)
  }

  const handleDragLeave = (e: DragEvent<HTMLElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDrop = (e: DragEvent<HTMLElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const files = Array.from(e.dataTransfer.files || [])
    if (files.length === 0) return

    const newPreviews = files.map((file) => previewOf(file))
    setClientImageFiles((prev) => [...prev, ...files])
    setClientImagePreviews((prev) => [...prev, ...newPreviews])
  }

  // Handle pasted images (copied from browser, screenshot, or clipboard)
  const handlePasteImages = (e: React.ClipboardEvent | ClipboardEvent, type: "client" | "self" = "client") => {
    const clipboardData = "clipboardData" in e ? e.clipboardData : null
    if (!clipboardData) return

    const items = clipboardData.items
    const filesFromClipboard: File[] = []

    if (items) {
      for (let i = 0; i < items.length; i++) {
        const item = items[i]
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile()
          if (file) {
            filesFromClipboard.push(file)
          }
        }
      }
    }

    if (filesFromClipboard.length === 0 && clipboardData.files?.length) {
      const files = Array.from(clipboardData.files)
      filesFromClipboard.push(...files)
    }

    if (filesFromClipboard.length > 0) {
      const activeEl = document.activeElement
      const isInputText = activeEl && (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA")
      if (!isInputText || activeEl.getAttribute("type") === "file") {
        e.preventDefault()
      }
      const newPreviews = filesFromClipboard.map((file) => previewOf(file))
      if (type === "client") {
        setClientImageFiles((prev) => [...prev, ...filesFromClipboard])
        setClientImagePreviews((prev) => [...prev, ...newPreviews])
      } else {
        setSelfImageFiles((prev) => [...prev, ...filesFromClipboard])
        setSelfImagePreviews((prev) => [...prev, ...newPreviews])
      }
      return
    }

    const pastedText = clipboardData.getData("text")?.trim()
    if (
      pastedText &&
      (pastedText.startsWith("data:image/") ||
        pastedText.match(/^https?:\/\/.*\.(png|jpg|jpeg|webp|gif|svg)(\?.*)?$/i))
    ) {
      const activeEl = document.activeElement
      const isInputText = activeEl && (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA")
      if (!isInputText || activeEl.getAttribute("type") === "file") {
        e.preventDefault()
      }
      fetch(pastedText)
        .then((res) => res.blob())
        .then((blob) => {
          const ext = blob.type.split("/")[1] || "png"
          const file = new File([blob], `pasted_image_${Date.now()}.${ext}`, {
            type: blob.type || "image/png",
          })
          const preview = URL.createObjectURL(file)
          if (type === "client") {
            setClientImageFiles((prev) => [...prev, file])
            setClientImagePreviews((prev) => [...prev, preview])
          } else {
            setSelfImageFiles((prev) => [...prev, file])
            setSelfImagePreviews((prev) => [...prev, preview])
          }
        })
        .catch((err) => {
          console.error("Failed to convert pasted image URL to file:", err)
        })
    }
  }

  useEffect(() => {
    const onWindowPaste = (e: ClipboardEvent) => {
      handlePasteImages(e)
    }
    window.addEventListener("paste", onWindowPaste)
    return () => {
      window.removeEventListener("paste", onWindowPaste)
    }
  }, [])

  const [uploadStatus, setUploadStatus] = useState<string | null>(null)

  // Direct upload of reference image files to Linode Object Storage via presigned URLs
  async function uploadReferenceImagesDirectly(files: File[]): Promise<string[]> {
    const uploadedUrls: string[] = []

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      setUploadStatus(`Uploading reference image ${i + 1} of ${files.length}...`)

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
            "x-amz-acl": "public-read",
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
        let clientUrls: string[] = []
        let selfUrls: string[] = []
        if (clientImageFiles.length > 0) {
          clientUrls = await uploadReferenceImagesDirectly(clientImageFiles)
        }
        if (selfImageFiles.length > 0) {
          selfUrls = await uploadReferenceImagesDirectly(selfImageFiles)
        }

        setUploadStatus("Saving task details...")

        const formData = new FormData()
        formData.append("customer_project_no", customerProjectNo)
        formData.append("speed", speed)
        formData.append("customer_code", selectedCustomerCode)
        formData.append("client_name", clientName)
        formData.append("category_code", categoryCode)
        formData.append("complexity", complexity)
        formData.append("work_type", workType)
        formData.append("version", versionInput)
        formData.append("sr_no", srNoFormatted)
        formData.append("cd_project_no", cdProjectNo)
        formData.append("request_date", requestDate)
        formData.append("assigned_to", assignedTo)
        formData.append("priority", priority)
        formData.append("description", description)
        formData.append("points", points)
        formData.append("deadline", deadline)
        formData.append("drive_folder_link", driveLink)
        formData.append("deliverables", serializeDeliverables(deliverables))

        clientUrls.forEach((url) => formData.append("client_reference_image_url", url))
        selfUrls.forEach((url) => formData.append("self_reference_image_url", url))

        const result = await createTaskAction(formData)
        if (result?.error) setError(result.error)
      } catch (err: any) {
        if (err?.message === "NEXT_REDIRECT" || err?.digest?.startsWith?.("NEXT_REDIRECT")) {
          throw err
        }
        console.error("Task creation error:", err)
        setError(err.message || "Failed to create task with uploaded images.")
      } finally {
        setUploadStatus(null)
      }
    })
  }



  return (
    <Card className="shadow-xs border-border">
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          {/* Header Banner showing Project No */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-primary/20 bg-primary/5 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-xs">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-semibold tracking-wider text-primary uppercase">
                  Project No.
                </p>
                <p className="font-mono text-xl font-bold tracking-tight text-foreground">
                  {cdProjectNo || "Enter Project No below"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="font-mono text-xs">
                Sr. No: #{srNoFormatted}
              </Badge>
              <Badge
                variant="secondary"
                className="bg-primary/10 text-primary font-semibold text-xs"
              >
                {versionInput || (workType === "New" ? "V1" : "V2")}
              </Badge>
            </div>
          </div>

          {error && (
            <div className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {/* Grid section 1: Project & Customer Specs */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {/* Project No (Manually Typed) */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cd_project_no">Project No. *</Label>
              <Input
                id="cd_project_no"
                name="cd_project_no"
                placeholder="e.g. U01RN0001V1"
                disabled={isPending}
                value={cdProjectNo}
                onChange={(e) => setCdProjectNo(e.target.value)}
                className="font-mono font-semibold"
                required
              />
            </div>

            {/* Customer Project No */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="customer_project_no">Customer Project No.</Label>
              <Input
                id="customer_project_no"
                name="customer_project_no"
                placeholder="e.g. PRJ-99201"
                disabled={isPending}
                value={customerProjectNo}
                onChange={(e) => setCustomerProjectNo(e.target.value)}
              />
            </div>

            {/* Request Date (DD-MM-YYYY) */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="request_date">Request Date (DD-MM-YYYY) *</Label>
              <Input
                id="request_date"
                name="request_date"
                placeholder="DD-MM-YYYY"
                required
                disabled={isPending}
                value={requestDate}
                onChange={(e) => handleRequestDateChange(e.target.value)}
              />
            </div>
          </div>

          {/* Grid section 2: Dropdowns for Speed, Customer, Category, Complexity */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Speed dropdown */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="speed">Speed *</Label>
              <Select
                value={speed}
                onValueChange={setSpeed}
                disabled={isPending}
              >
                <SelectTrigger id="speed">
                  <SelectValue placeholder="Select speed" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="U">U (Urgent)</SelectItem>
                  <SelectItem value="N">N (Normal)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Customer Name dropdown */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="customer_select">Customer Name *</Label>
              {customers.length > 0 ? (
                <Select
                  value={selectedCustomerCode}
                  onValueChange={handleCustomerChange}
                  disabled={isPending}
                >
                  <SelectTrigger id="customer_select">
                    <SelectValue placeholder="Select customer..." />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map((c) => (
                      <SelectItem key={c.uuid} value={c.code}>
                        <span className="font-mono font-semibold">{c.code}</span>
                        {" - "}
                        <span>{c.name}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  placeholder="No customers found in database"
                  disabled
                  readOnly
                />
              )}
            </div>

            {/* Category dropdown */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="category_code">Category Name *</Label>
              <Select
                value={categoryCode}
                onValueChange={handleCategoryChange}
                disabled={isPending}
              >
                <SelectTrigger id="category_code">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat.code} value={cat.code}>
                      <span className="font-mono font-semibold">
                        {cat.code}
                      </span>
                      {" - "}
                      <span>{cat.label}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Complexity dropdown */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="complexity">Complexity *</Label>
              <Select
                value={complexity}
                onValueChange={setComplexity}
                disabled={isPending}
              >
                <SelectTrigger id="complexity">
                  <SelectValue placeholder="Select complexity" />
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
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {/* Work Type dropdown */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="work_type">Type of Work *</Label>
              <Select
                value={workType}
                onValueChange={(val) => handleWorkTypeChange(val as "New" | "Old")}
                disabled={isPending}
              >
                <SelectTrigger id="work_type">
                  <SelectValue placeholder="Select work type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="New">New (V1)</SelectItem>
                  <SelectItem value="Old">Old / Revision (V2+)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Version Text Field */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="version">Version *</Label>
              <Input
                id="version"
                name="version"
                placeholder="e.g. V1, V2"
                disabled={isPending}
                value={versionInput}
                onChange={(e) => setVersionInput(e.target.value)}
                className="font-mono font-semibold"
              />
            </div>

            {/* Sr No (Read-only display) */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="sr_no">Sr. No. (Auto Generated)</Label>
              <Input
                id="sr_no"
                name="sr_no"
                value={srNoFormatted}
                readOnly
                disabled
                className="bg-muted font-mono font-semibold"
              />
            </div>
          </div>

          {/* Deliverables checklist */}
          <div className="flex flex-col gap-3 rounded-xl border border-border bg-muted/20 p-4">
            <div>
              <Label className="text-sm font-semibold">Required Deliverables</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Select what the designer must submit. Edit labels or add custom deliverables.
              </p>
            </div>
            <div className="space-y-2">
              {deliverables.map((item) => (
                <div key={item.id} className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
                  <Checkbox
                    id={`deliverable-${item.id}`}
                    checked={item.required}
                    onCheckedChange={(checked) =>
                      updateDeliverable(item.id, { required: Boolean(checked) })
                    }
                    disabled={isPending}
                  />
                  <Input
                    value={item.label}
                    onChange={(e) => updateDeliverable(item.id, { label: e.target.value })}
                    className="h-8 text-xs flex-1"
                    disabled={isPending}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => removeDeliverable(item.id)}
                    disabled={isPending}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Add custom deliverable..."
                value={newDeliverableLabel}
                onChange={(e) => setNewDeliverableLabel(e.target.value)}
                className="h-9 text-xs"
                disabled={isPending}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addDeliverable}
                disabled={isPending || !newDeliverableLabel.trim()}
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Add
              </Button>
            </div>
          </div>

          {/* Client reference images */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="client_reference_image">Client References</Label>
            <p className="text-xs text-muted-foreground">
              Images or files provided by the client for this job.
            </p>
            <div className="flex flex-wrap items-start gap-4">
              <label
                htmlFor="client_reference_image"
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setIsDragging(false)
                  const files = Array.from(e.dataTransfer.files || [])
                  const newPreviews = files.map((file) => previewOf(file))
                  setClientImageFiles((prev) => [...prev, ...files])
                  setClientImagePreviews((prev) => [...prev, ...newPreviews])
                }}
                className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-4 text-center transition-all w-full sm:w-auto min-w-[220px] min-h-[100px] ${
                  isDragging
                    ? "border-primary bg-primary/10 ring-4 ring-primary/20 scale-[1.01]"
                    : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30"
                }`}
              >
                <ImageIcon className="h-6 w-6 text-muted-foreground mb-1" />
                <span className="text-xs font-medium text-foreground">Upload Client References</span>
                <input
                  id="client_reference_image"
                  name="client_reference_image"
                  type="file"
                  multiple
                  onChange={(e) => handleImageChange(e, "client")}
                  className="hidden"
                  disabled={isPending}
                />
              </label>
              {clientImagePreviews.map((preview, index) => (
                <div key={index} className="relative h-24 w-24 overflow-hidden rounded-lg border border-border bg-muted shrink-0">
                  {preview ? (
                    <img src={preview} alt={`Client ref ${index + 1}`} className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center break-all p-1 text-center text-[9px] text-muted-foreground">
                      {clientImageFiles[index]?.name}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => removeImagePreview(index, "client")}
                    className="absolute top-1 right-1 rounded-full bg-background/80 p-1 text-foreground hover:bg-background shadow-xs"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Self reference images */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="self_reference_image">Self References</Label>
            <p className="text-xs text-muted-foreground">
              Internal reference images, sketches, or notes from your team.
            </p>
            <div className="flex flex-wrap items-start gap-4">
              <label
                htmlFor="self_reference_image"
                className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 p-4 text-center transition-all w-full sm:w-auto min-w-[220px] min-h-[100px] hover:border-primary/50 hover:bg-muted/30"
              >
                <ImageIcon className="h-6 w-6 text-muted-foreground mb-1" />
                <span className="text-xs font-medium text-foreground">Upload Self References</span>
                <input
                  id="self_reference_image"
                  name="self_reference_image"
                  type="file"
                  multiple
                  onChange={(e) => handleImageChange(e, "self")}
                  className="hidden"
                  disabled={isPending}
                />
              </label>
              {selfImagePreviews.map((preview, index) => (
                <div key={index} className="relative h-24 w-24 overflow-hidden rounded-lg border border-border bg-muted shrink-0">
                  {preview ? (
                    <img src={preview} alt={`Self ref ${index + 1}`} className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center break-all p-1 text-center text-[9px] text-muted-foreground">
                      {selfImageFiles[index]?.name}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => removeImagePreview(index, "self")}
                    className="absolute top-1 right-1 rounded-full bg-background/80 p-1 text-foreground hover:bg-background shadow-xs"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="description">Description / Work Notes</Label>
            <Textarea
              id="description"
              name="description"
              placeholder="Provide design dimensions, stone sizes, or special instructions..."
              rows={3}
              disabled={isPending}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="points">Points</Label>
              <Input
                id="points"
                name="points"
                type="number"
                step="any"
                min={0}
                placeholder="e.g. 10.5"
                disabled={isPending}
                value={points}
                onChange={(e) => setPoints(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="deadline">Deadline (DD-MM-YYYY)</Label>
              <Input
                id="deadline"
                name="deadline"
                placeholder="DD-MM-YYYY"
                disabled={isPending}
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2 rounded-xl border border-primary/20 bg-primary/5 p-4">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-foreground text-xs uppercase tracking-wide">
                Linode Storage Task Directory
              </span>
              <Badge variant="secondary" className="text-[10px] font-semibold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30">
                Auto-created on submit
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              A dedicated folder <code className="font-mono text-foreground font-semibold">tasks/&#123;{[cdProjectNo, customerProjectNo, srNoFormatted, versionInput].map(s => (s || "").trim()).filter(Boolean).join("-") || "foldername"}&#125;/</code> will be created in Linode Object Storage for all reference images and CAD file uploads (.3dm, .glb, etc.).
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Assign to Designer</Label>
            <Select
              value={assignedTo}
              onValueChange={setAssignedTo}
              disabled={isPending}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a designer..." />
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

          <div className="mt-2 flex justify-end">
            <Button type="submit" disabled={isPending} className="w-full sm:w-auto">
              {isPending ? (uploadStatus || "Creating Task...") : "Create Task"}
            </Button>
          </div>

        </form>
      </CardContent>
    </Card>
  )
}

