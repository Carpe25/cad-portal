"use server"

import bcrypt from "bcryptjs"
import { sql } from "@/lib/db"
import { getSession } from "@/lib/session"

export async function addMemberAction(formData: FormData) {
  const session = await getSession()
  if (!session || !session.roles.includes("manager")) {
    return { error: "Unauthorized" }
  }

  const name = formData.get("name") as string
  const email = formData.get("email") as string
  const password = formData.get("password") as string
  const rateStr = formData.get("rate_per_point") as string
  const rolesStr = formData.get("roles") as string

  if (!name || !email || !password) {
    return { error: "Name, email, and password are required" }
  }

  const roles = rolesStr ? rolesStr.split(",").filter(Boolean) : ["designer"]
  const rate = parseFloat(rateStr) || 0

  const existing = await sql`SELECT id FROM users WHERE email = ${email.toLowerCase()}`
  if (existing.length > 0) {
    return { error: "A user with this email already exists" }
  }

  const hash = await bcrypt.hash(password, 10)
  await sql`
    INSERT INTO users (name, email, password_hash, roles, rate_per_point)
    VALUES (${name}, ${email.toLowerCase()}, ${hash}, ${roles}::text[], ${rate})
  `
}
