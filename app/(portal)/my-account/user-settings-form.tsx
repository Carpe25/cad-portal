"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { updateUserSettingsAction } from "./actions"

type User = {
    id: string
    name: string
    email: string
}

export default function UserSettingsForm({ user }: { user: User }) {
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState<string | null>(null)
    const [isPending, startTransition] = useTransition()
    const router = useRouter()

    function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        setError(null)
        setSuccess(null)

        // 1. Capture the form reference synchronously BEFORE the async transition
        const form = e.currentTarget
        const formData = new FormData(form)

        const currentPassword = formData.get("current_password") as string
        const newPassword = formData.get("new_password") as string
        const confirmPassword = formData.get("confirm_password") as string

        if (currentPassword || newPassword || confirmPassword) {
            if (!currentPassword) {
                setError("Please enter your current password to change it.")
                return
            }
            if (newPassword !== confirmPassword) {
                setError("New passwords do not match.")
                return
            }
            if (newPassword.length > 0 && newPassword.length < 6) {
                setError("New password must be at least 6 characters.")
                return
            }
        }

        startTransition(async () => {
            const result = await updateUserSettingsAction(user.id, formData)

            if (result?.error) {
                setError(result.error)
            } else {
                setSuccess("Settings updated successfully.")

                // 2. Safely clear ONLY the password fields using our captured 'form' reference
                const currentPassInput = form.elements.namedItem("current_password") as HTMLInputElement
                const newPassInput = form.elements.namedItem("new_password") as HTMLInputElement
                const confirmPassInput = form.elements.namedItem("confirm_password") as HTMLInputElement

                if (currentPassInput) currentPassInput.value = ""
                if (newPassInput) newPassInput.value = ""
                if (confirmPassInput) confirmPassInput.value = ""

                router.refresh()
            }
        })
    }

    return (
        <div className="mx-auto max-w-2xl px-4 py-8">
            <div className="mb-8">
                <h1 className="text-2xl font-bold tracking-tight">Account Settings</h1>
                <p className="text-muted-foreground">
                    Manage your account profile and security.
                </p>
            </div>

            <div className="rounded-lg border bg-card p-6 shadow-sm">
                <form onSubmit={handleSubmit} className="flex flex-col gap-6">
                    {/* Profile Section */}
                    <div className="space-y-4">
                        <h2 className="text-lg font-semibold">Profile Information</h2>

                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="edit-name">Full Name *</Label>
                            <Input
                                id="edit-name"
                                name="name"
                                defaultValue={user.name}
                                required
                                disabled={isPending}
                            />
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="edit-email">Email Address *</Label>
                            <Input
                                id="edit-email"
                                name="email"
                                type="email"
                                defaultValue={user.email}
                                required
                                disabled={isPending}
                            />
                        </div>
                    </div>

                    <hr className="border-border" />

                    {/* Security Section */}
                    <div className="space-y-4">
                        <div>
                            <h2 className="text-lg font-semibold">Change Password</h2>
                            <p className="text-sm text-muted-foreground">
                                Leave these fields blank if you do not wish to change your password.
                            </p>
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="current-password">Current Password</Label>
                            <Input
                                id="current-password"
                                name="current_password"
                                type="password"
                                placeholder="••••••••"
                                disabled={isPending}
                            />
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="new-password">New Password</Label>
                            <Input
                                id="new-password"
                                name="new_password"
                                type="password"
                                placeholder="••••••••"
                                disabled={isPending}
                            />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="confirm-password">Confirm New Password</Label>
                            <Input
                                id="confirm-password"
                                name="confirm_password"
                                type="password"
                                placeholder="••••••••"
                                disabled={isPending}
                            />
                        </div>
                    </div>
                    {/* Messages */}
                    {error && (
                        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
                            {error}
                        </p>
                    )}
                    {success && (
                        <p className="rounded-md bg-emerald-500/10 px-3 py-2 text-sm font-medium text-emerald-600 dark:text-emerald-400">
                            {success}
                        </p>
                    )}

                    {/* Actions */}
                    <div className="flex gap-3 pt-2">
                        <Button type="submit" disabled={isPending}>
                            {isPending ? "Saving Changes…" : "Save Changes"}
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            disabled={isPending}
                            onClick={() => router.back()}
                        >
                            Cancel
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    )
}