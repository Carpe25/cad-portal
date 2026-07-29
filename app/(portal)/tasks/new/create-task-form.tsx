"use client"

import { useState, useTransition, ChangeEvent } from "react"
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
import { CalendarIcon, Image as ImageIcon, Sparkles, X, FolderPlus, Check } from "lucide-react"


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

const COMPLEXITIES = ["A", "B", "C", "D"]
const SPEEDS = ["U", "N"]

function formatDateForFolderName(dateStr: string): string {
  if (!dateStr) return ""
  const parts = dateStr.split("-")
  if (parts.length !== 3) return dateStr
  const year = parts[0].slice(-2)
  const monthIdx = parseInt(parts[1], 10) - 1
  const day = parts[2].padStart(2, "0")
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
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
  const [requestDate, setRequestDate] = useState(
    new Date().toISOString().split("T")[0]
  )

  // Handle Work Type change
  const handleWorkTypeChange = (val: "New" | "Old") => {
    setWorkType(val)
    setVersionInput(val === "New" ? "V1" : "V2")
  }

  // Standard task fields
  const [description, setDescription] = useState("")
  const [deadline, setDeadline] = useState("")
  const [points, setPoints] = useState("")
  const [driveLink, setDriveLink] = useState("")
  const [priority, setPriority] = useState("medium")
  const [assignedTo, setAssignedTo] = useState("")

  // Reference image files and previews state
  const [selectedImageFiles, setSelectedImageFiles] = useState<File[]>([])
  const [imagePreviews, setImagePreviews] = useState<string[]>([])

  // Auto-generate Sr. No. (4 digits e.g. 0001)
  const srNoFormatted = String(nextSrNoCount).padStart(4, "0")

  // Auto-generate CD Project No.
  const cdProjectBase = `${speed}${selectedCustomerCode}${categoryCode}${complexity}${srNoFormatted}`
  const cdProjectNo = `${cdProjectBase}${versionInput.trim()}`

  // Proposed Google Drive folder name format: U01RND00001_CRkajal1-6-26_V1_01-Jun-26
  const formattedDate = formatDateForFolderName(requestDate)
  const folderParts = [
    cdProjectBase,
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

  // Handle reference images selection (multiple)
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

  // Submit handler using FormData to avoid large base64 React Server Action serialization issues
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    startTransition(async () => {
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

      selectedImageFiles.forEach((file) => {
        formData.append("reference_image", file)
      })

      const result = await createTaskAction(formData)
      if (result?.error) setError(result.error)
    })
  }

  return (
    <Card className="shadow-xs border-border">
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          {/* Header Banner showing Auto-generated CD Project No */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-primary/20 bg-primary/5 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-xs">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-semibold tracking-wider text-primary uppercase">
                  Auto-Generated CD Project No.
                </p>
                <p className="font-mono text-xl font-bold tracking-tight text-foreground">
                  {cdProjectNo}
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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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

            {/* Request Date */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="request_date">Request Date *</Label>
              <div className="relative">
                <Input
                  id="request_date"
                  name="request_date"
                  type="date"
                  required
                  disabled={isPending}
                  value={requestDate}
                  onChange={(e) => setRequestDate(e.target.value)}
                />
              </div>
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
                onValueChange={setCategoryCode}
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


          {/* Reference Image Upload Field */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="reference_image">Reference Images</Label>
            <div className="flex flex-wrap items-start gap-4">
              <label
                htmlFor="reference_image"
                className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 p-4 text-center hover:border-primary/50 hover:bg-muted/30 transition-colors w-full sm:w-auto min-w-[200px] min-h-[96px]"
              >
                <ImageIcon className="h-6 w-6 text-muted-foreground mb-1" />
                <span className="text-xs font-medium text-foreground">
                  Upload Reference Images
                </span>
                <span className="text-[10px] text-muted-foreground">
                  PNG, JPG, WEBP up to 10MB (Multiple allowed)
                </span>
                <input
                  id="reference_image"
                  name="reference_image"
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageChange}
                  className="hidden"
                  disabled={isPending}
                />
              </label>

              {imagePreviews.map((preview, index) => (
                <div key={index} className="relative h-24 w-24 overflow-hidden rounded-lg border border-border bg-muted shrink-0">
                  <img
                    src={preview}
                    alt={`Reference preview ${index + 1}`}
                    className="h-full w-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removeImagePreview(index)}
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
                min={0}
                placeholder="e.g. 10"
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

          <div className="flex flex-col gap-2 rounded-xl border border-primary/20 bg-primary/5 p-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <Label htmlFor="drive_folder_link" className="font-semibold text-foreground">
                  Google Drive Folder
                </Label>
                <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                  <span>Proposed Name:</span>
                  <Badge variant="outline" className="font-mono text-xs font-semibold bg-background">
                    {proposedFolderName}
                  </Badge>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isPending || isCreatingDriveFolder}
                onClick={handleConnectToDrive}
                className="gap-2 border-primary/40 text-primary hover:bg-primary/10 self-start sm:self-auto"
              >
                <FolderPlus className="h-4 w-4" />
                {isCreatingDriveFolder ? "Creating Folder..." : "Connect to Drive"}
              </Button>
            </div>

            <Input
              id="drive_folder_link"
              name="drive_folder_link"
              placeholder="https://drive.google.com/drive/folders/..."
              disabled={isPending || isCreatingDriveFolder}
              value={driveLink}
              onChange={(e) => setDriveLink(e.target.value)}
              className="bg-background"
            />

            {driveFolderSuccess && (
              <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                <Check className="h-3.5 w-3.5" />
                Folder created & connected to Drive successfully!
              </div>
            )}
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
              {isPending ? "Creating Task..." : "Create Task"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
