"use server"

import bcrypt from "bcryptjs"
import { redirect } from "next/navigation"
import { sql } from "@/lib/db"
import { createSession } from "@/lib/session"

export async function loginAction(formData: FormData) {
  const email = formData.get("email") as string
  const password = formData.get("password") as string

  if (!email || !password) {
    return { error: "Email and password are required" }
  }

  const rows = await sql`
    SELECT id, name, email, password_hash, roles
    FROM users
    WHERE email = ${email.trim().toLowerCase()}
      AND active = true
    LIMIT 1
  `

  const user = rows[0] as
    | {
        id: string
        name: string
        email: string
        password_hash: string
        roles: string[]
      }
    | undefined

  if (!user) {
    return { error: "Invalid email or password" }
  }

  const valid = await bcrypt.compare(password, user.password_hash)
  if (!valid) {
    return { error: "Invalid email or password" }
  }

  await createSession({
    id: user.id,
    name: user.name,
    email: user.email,
    roles: user.roles,
  })

  redirect("/dashboard")
}
