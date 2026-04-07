"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { editMemberAction } from "./actions"
import { Pencil } from "lucide-react"

type Member = {
  id: string
  name: string
  email: string
  roles: string[]
  rate_per_point: number
  experience_years: number
  active: boolean
}

export function EditMemberButton({ member }: { member: Member }) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [roles, setRoles] = useState<string[]>(member.roles)
  const [active, setActive] = useState(member.active)
  const router = useRouter()

  function toggleRole(role: string) {
    setRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    )
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const formData = new FormData(e.currentTarget)
    formData.set("roles", roles.join(","))
    formData.set("active", String(active))
    startTransition(async () => {
      const result = await editMemberAction(member.id, formData)
      if (result?.error) {
        setError(result.error)
      } else {
        setOpen(false)
        router.refresh()
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 px-2 text-muted-foreground hover:text-foreground">
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Member</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 pt-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-name">Full Name *</Label>
            <Input
              id="edit-name"
              name="name"
              defaultValue={member.name}
              required
              disabled={isPending}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-email">Email *</Label>
            <Input
              id="edit-email"
              name="email"
              type="email"
              defaultValue={member.email}
              required
              disabled={isPending}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-rate">Rate per Point (₹)</Label>
              <Input
                id="edit-rate"
                name="rate_per_point"
                type="number"
                min={0}
                defaultValue={member.rate_per_point}
                disabled={isPending}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-experience">Experience (yrs)</Label>
              <Input
                id="edit-experience"
                name="experience_years"
                type="number"
                min={0}
                defaultValue={member.experience_years}
                disabled={isPending}
              />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label>Roles</Label>
            <div className="flex gap-4">
              {["designer", "qc", "manager"].map((r) => (
                <label key={r} className="flex cursor-pointer items-center gap-1.5 text-sm capitalize">
                  <Checkbox
                    checked={roles.includes(r)}
                    onCheckedChange={() => toggleRole(r)}
                    disabled={isPending}
                  />
                  {r}
                </label>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label>Status</Label>
            <label className="flex cursor-pointer items-center gap-1.5 text-sm">
              <Checkbox
                checked={active}
                onCheckedChange={(v) => setActive(!!v)}
                disabled={isPending}
              />
              Active
            </label>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-password">New Password <span className="text-muted-foreground">(leave blank to keep current)</span></Label>
            <Input
              id="edit-password"
              name="new_password"
              type="password"
              placeholder="••••••••"
              disabled={isPending}
            />
          </div>
          {error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="flex gap-2 pt-1">
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving…" : "Save Changes"}
            </Button>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
              Cancel
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
