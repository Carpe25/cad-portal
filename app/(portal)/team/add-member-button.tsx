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
import { addMemberAction } from "./actions"
import { UserPlus } from "lucide-react"
import { PasswordInput } from "@/components/password-input"

export function AddMemberButton() {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [roles, setRoles] = useState<string[]>(["designer"])
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
    startTransition(async () => {
      const result = await addMemberAction(formData)
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
        <Button>
          <UserPlus className="mr-2 h-4 w-4" />
          Add Member
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Team Member</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 pt-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Full Name *</Label>
            <Input
              id="name"
              name="name"
              placeholder="Priya Sharma"
              required
              disabled={isPending}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">Email *</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="priya@carpediam.com"
              required
              disabled={isPending}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">Temporary Password *</Label>
            <PasswordInput
              id="password"
              name="password"
              placeholder="••••••••"
              required
              disabled={isPending}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="rate_per_point">Rate per Point (₹)</Label>
              <Input
                id="rate_per_point"
                name="rate_per_point"
                type="number"
                min={0}
                placeholder="200"
                disabled={isPending}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="experience_years">Experience (yrs)</Label>
              <Input
                id="experience_years"
                name="experience_years"
                type="number"
                min={0}
                placeholder="3"
                disabled={isPending}
              />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label>Roles</Label>
            <div className="flex gap-4">
              {["designer", "qc", "manager"].map((r) => (
                <label
                  key={r}
                  className="flex cursor-pointer items-center gap-1.5 text-sm capitalize"
                >
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
          {error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="flex gap-2 pt-1">
            <Button type="submit" disabled={isPending}>
              {isPending ? "Adding…" : "Add Member"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
