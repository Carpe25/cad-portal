"use server"
import bcrypt from "bcryptjs"
import { sql } from "@/lib/db"
import { getSession } from "@/lib/session"

export async function updateUserSettingsAction(userId: string, formData: FormData) {
    const session = await getSession()

    // Ensure session exists and the user is updating their OWN profile.
    // Note: Adjust `session.id` to match whatever property your session uses for the user's ID.
    if (!session || session.id !== userId) {
        return { error: "Unauthorized" }
    }

    const name = formData.get("name") as string
    const email = formData.get("email") as string
    const currentPassword = formData.get("current_password") as string
    const newPassword = formData.get("new_password") as string
    const confirmPassword = formData.get("confirm_password") as string

    if (!name || !email) {
        return { error: "Name and email are required" }
    }

    // 1. Check for email conflicts
    const conflict = await sql`
    SELECT id FROM users WHERE email = ${email.toLowerCase()} AND id != ${userId}
  `
    if (conflict.length > 0) {
        return { error: "This email is already in use by another account." }
    }

    let newPasswordHash = null;

    // 2. Handle Password Update Logic
    if (currentPassword || newPassword || confirmPassword) {
        if (!currentPassword) return { error: "Current password is required." }
        if (newPassword !== confirmPassword) return { error: "New passwords do not match." }
        if (newPassword.length < 6) return { error: "New password must be at least 6 characters." }

        // Fetch the user's current password hash to verify
        const userRecords = await sql`SELECT password_hash FROM users WHERE id = ${userId}`
        if (userRecords.length === 0) {
            return { error: "User not found." }
        }

        const isPasswordValid = await bcrypt.compare(currentPassword, userRecords[0].password_hash)
        if (!isPasswordValid) {
            return { error: "Incorrect current password." }
        }

        // Hash the new password
        newPasswordHash = await bcrypt.hash(newPassword, 10)
    }

    // 3. Update Database
    try {
        if (newPasswordHash) {
            // Update with new password
            await sql`
        UPDATE users
        SET name = ${name},
            email = ${email.toLowerCase()},
            password_hash = ${newPasswordHash}
        WHERE id = ${userId}
      `
        } else {
            // Update without changing the password
            await sql`
        UPDATE users
        SET name = ${name},
            email = ${email.toLowerCase()}
        WHERE id = ${userId}
      `
        }

        return { error: null }
    } catch (err) {
        console.error("Settings Update Error:", err)
        return { error: "Failed to update settings. Please try again." }
    }
}