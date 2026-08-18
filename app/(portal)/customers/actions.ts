"use server"

import { sql } from "@/lib/db"
import { getSession } from "@/lib/session"
import { revalidatePath } from "next/cache"

export async function ensureCustomerTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS customer (
      uuid UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `
}

export async function addCustomerAction(formData: FormData) {
  const session = await getSession()
  if (!session) {
    return { error: "Unauthorized" }
  }

  const code = (formData.get("code") as string)?.trim()
  const name = (formData.get("name") as string)?.trim()

  if (!code || !name) {
    return { error: "Both Code and Name are required" }
  }

  try {
    await ensureCustomerTable()

    // Check for duplicate code
    const existing = await sql`
      SELECT uuid FROM customer WHERE LOWER(code) = LOWER(${code}) LIMIT 1
    `
    if (existing.length > 0) {
      return { error: `Customer with code "${code}" already exists` }
    }

    await sql`
      INSERT INTO customer (code, name)
      VALUES (${code}, ${name})
    `

    revalidatePath("/customers")
    return { error: null }
  } catch (err: any) {
    console.error("Error creating customer:", err)
    return { error: err?.message || "Failed to create customer. Please try again." }
  }
}

export async function updateCustomerAction(uuid: string, formData: FormData) {
  const session = await getSession()
  if (!session) {
    return { error: "Unauthorized" }
  }

  const code = (formData.get("code") as string)?.trim()
  const name = (formData.get("name") as string)?.trim()

  if (!uuid || !code || !name) {
    return { error: "Code and Name are required" }
  }

  try {
    await ensureCustomerTable()

    // Check for duplicate code in other customers
    const existing = await sql`
      SELECT uuid FROM customer WHERE LOWER(code) = LOWER(${code}) AND uuid != ${uuid} LIMIT 1
    `
    if (existing.length > 0) {
      return { error: `Customer with code "${code}" already exists` }
    }

    await sql`
      UPDATE customer
      SET code = ${code}, name = ${name}
      WHERE uuid = ${uuid}
    `

    revalidatePath("/customers")
    return { error: null }
  } catch (err: any) {
    console.error("Error updating customer:", err)
    return { error: err?.message || "Failed to update customer. Please try again." }
  }
}

