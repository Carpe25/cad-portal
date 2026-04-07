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
  const experienceStr = formData.get("experience_years") as string

  if (!name || !email || !password) {
    return { error: "Name, email, and password are required" }
  }

  const roles = rolesStr ? rolesStr.split(",").filter(Boolean) : ["designer"]
  const rate = parseFloat(rateStr) || 0
  const experience = parseInt(experienceStr) || 0

  const existing = await sql`SELECT id FROM users WHERE email = ${email.toLowerCase()}`
  if (existing.length > 0) {
    return { error: "A user with this email already exists" }
  }

  try {
    const hash = await bcrypt.hash(password, 10)
    await sql`
      INSERT INTO users (name, email, password_hash, roles, rate_per_point, experience_years)
      VALUES (${name}, ${email.toLowerCase()}, ${hash}, ${roles}::text[], ${rate}, ${experience})
    `
    return { error: null }
  } catch {
    return { error: "Failed to create user. Please try again." }
  }
}

export async function editMemberAction(memberId: string, formData: FormData) {
  const session = await getSession()
  if (!session || !session.roles.includes("manager")) {
    return { error: "Unauthorized" }
  }

  const name = formData.get("name") as string
  const email = formData.get("email") as string
  const rateStr = formData.get("rate_per_point") as string
  const rolesStr = formData.get("roles") as string
  const experienceStr = formData.get("experience_years") as string
  const active = formData.get("active") === "true"
  const newPassword = formData.get("new_password") as string

  if (!name || !email) {
    return { error: "Name and email are required" }
  }

  const roles = rolesStr ? rolesStr.split(",").filter(Boolean) : ["designer"]
  const rate = parseFloat(rateStr) || 0
  const experience = parseInt(experienceStr) || 0

  const conflict = await sql`
    SELECT id FROM users WHERE email = ${email.toLowerCase()} AND id != ${memberId}
  `
  if (conflict.length > 0) {
    return { error: "Another user with this email already exists" }
  }

  try {
    await sql`
      UPDATE users
      SET name = ${name},
          email = ${email.toLowerCase()},
          roles = ${roles}::text[],
          rate_per_point = ${rate},
          experience_years = ${experience},
          active = ${active}
      WHERE id = ${memberId}
    `

    if (newPassword) {
      const hash = await bcrypt.hash(newPassword, 10)
      await sql`UPDATE users SET password_hash = ${hash} WHERE id = ${memberId}`
    }

    return { error: null }
  } catch {
    return { error: "Failed to update member. Please try again." }
  }
}
