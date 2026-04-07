import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { sql } from "@/lib/db"

// One-time setup route to create the first manager account.
// Hit POST /api/setup with { name, email, password }
// Returns 409 if a manager already exists.

export async function POST(req: NextRequest) {
  const existing = await sql`
    SELECT id FROM users WHERE roles @> ARRAY['manager']::text[] LIMIT 1
  `
  if (existing.length > 0) {
    return NextResponse.json(
      { error: "A manager account already exists" },
      { status: 409 }
    )
  }

  const { name, email, password } = await req.json()
  if (!name || !email || !password) {
    return NextResponse.json(
      { error: "name, email and password are required" },
      { status: 400 }
    )
  }

  const hash = await bcrypt.hash(password, 10)
  const rows = await sql`
    INSERT INTO users (name, email, password_hash, roles, rate_per_point)
    VALUES (${name}, ${email.trim().toLowerCase()}, ${hash}, ARRAY['manager','designer']::text[], 0)
    RETURNING id, name, email, roles
  `

  return NextResponse.json({ ok: true, user: rows[0] })
}
