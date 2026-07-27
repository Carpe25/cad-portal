"use client"

import { useState, useTransition, ChangeEvent } from "react"
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
import { CalendarIcon, Image as ImageIcon, Sparkles, X } from "lucide-react"

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
  const [requestDate, setRequestDate] = useState(
    new Date().toISOString().split("T")[0]
  )

  // Standard task fields
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [deadline, setDeadline] = useState("")
  const [points, setPoints] = useState("")
  const [driveLink, setDriveLink] = useState("")
  const [priority, setPriority] = useState("medium")
  const [assignedTo, setAssignedTo] = useState("")

  // Reference image preview state
  const [imagePreview, setImagePreview] = useState<string | null>(null)

  // Auto-generate Sr. No. (4 digits e.g. 0001)
  const srNoFormatted = String(nextSrNoCount).padStart(4, "0")

  // Auto-generate CD Project No.
  const versionStr = workType === "New" ? "V1" : "V2"
  const cdProjectNo = `${speed}${selectedCustomerCode}${categoryCode}${complexity}${srNoFormatted}${versionStr}`

  // Update customer when selection changes
  const handleCustomerChange = (code: string) => {
    setSelectedCustomerCode(code)
    const cust = customers.find((c) => c.code === code)
    if (cust) {
      setClientName(cust.name)
    }
  }

  // Handle reference image selection
  const handleImageChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        setImagePreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    } else {
      setImagePreview(null)
    }
  }

  // Submit handler
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const formData = new FormData(e.currentTarget)
    formData.set("customer_project_no", customerProjectNo)
    formData.set("speed", speed)
    formData.set("customer_code", selectedCustomerCode)
    formData.set("client_name", clientName)
    formData.set("category_code", categoryCode)
    formData.set("complexity", complexity)
    formData.set("work_type", workType)
    formData.set("sr_no", srNoFormatted)
    formData.set("cd_project_no", cdProjectNo)
    formData.set("request_date", requestDate)
    formData.set("assigned_to", assignedTo)
    formData.set("priority", priority)

    // Default title to CD project no. if empty
    if (!formData.get("title")) {
      formData.set("title", cdProjectNo)
    }

    startTransition(async () => {
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
                {workType === "New" ? "Version 1" : "Version 2+"}
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

          {/* Grid section 2: Dropdowns for Speed, Customer, Category, Complexity, Work Type */}
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

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Work Type dropdown */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="work_type">Type of Work *</Label>
              <Select
                value={workType}
                onValueChange={(val) => setWorkType(val as "New" | "Old")}
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
            <Label htmlFor="reference_image">Reference Image</Label>
            <div className="flex flex-col sm:flex-row items-start gap-4">
              <label
                htmlFor="reference_image"
                className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 p-4 text-center hover:border-primary/50 hover:bg-muted/30 transition-colors w-full sm:w-auto min-w-[200px]"
              >
                <ImageIcon className="h-6 w-6 text-muted-foreground mb-1" />
                <span className="text-xs font-medium text-foreground">
                  Upload Reference Image
                </span>
                <span className="text-[10px] text-muted-foreground">
                  PNG, JPG, WEBP up to 10MB
                </span>
                <input
                  id="reference_image"
                  name="reference_image"
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="hidden"
                  disabled={isPending}
                />
              </label>

              {imagePreview && (
                <div className="relative h-24 w-24 overflow-hidden rounded-lg border border-border bg-muted">
                  <img
                    src={imagePreview}
                    alt="Reference preview"
                    className="h-full w-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => setImagePreview(null)}
                    className="absolute top-1 right-1 rounded-full bg-background/80 p-1 text-foreground hover:bg-background"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Standard task details */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="title">Task Title / Name</Label>
            <Input
              id="title"
              name="title"
              placeholder={`Default: ${customerProjectNo || "Customer Project Name/No."}`}
              disabled={isPending}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Leave blank to default to Customer Project No.
            </p>
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

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="drive_folder_link">Google Drive Folder Link</Label>
            <Input
              id="drive_folder_link"
              name="drive_folder_link"
              placeholder="https://drive.google.com/drive/folders/..."
              disabled={isPending}
              value={driveLink}
              onChange={(e) => setDriveLink(e.target.value)}
            />
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
