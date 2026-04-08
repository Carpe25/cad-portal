"use client"

import { useState, useTransition } from "react"
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

export function CreateTaskForm({
  designers,
}: {
  designers: { id: string; name: string }[]
}) {
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [assignedTo, setAssignedTo] = useState("")

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
    <Card className="max-w-2xl shadow-xs">
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
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="style_ref_number">Style / Ref Number</Label>
              <Input
                id="style_ref_number"
                name="style_ref_number"
                placeholder="e.g. STY-2024-089"
                disabled={isPending}
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
              rows={3}
              disabled={isPending}
            />
          </div>

          {/* Points */}
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
            />
          </div>

          {/* Deadline */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="deadline">Deadline</Label>
            <Input
              id="deadline"
              name="deadline"
              type="date"
              disabled={isPending}
            />
          </div>

          {/* Drive Folder Link */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="drive_folder_link">Google Drive Folder Link</Label>
            <Input
              id="drive_folder_link"
              name="drive_folder_link"
              placeholder="https://drive.google.com/drive/folders/..."
              disabled={isPending}
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
  )
}
