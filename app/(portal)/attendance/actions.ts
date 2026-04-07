"use server"

import { sql } from "@/lib/db"
import { getSession } from "@/lib/session"

export async function clockIn() {
  const session = await getSession()
  if (!session) return

  const today = new Date().toISOString().split("T")[0]

  // Upsert — only one record per user per day
  await sql`
    INSERT INTO attendance (user_id, date, login_at)
    VALUES (${session.id}, ${today}, now())
    ON CONFLICT (user_id, date) DO NOTHING
  `
}

export async function clockOut(attendanceId: string) {
  const session = await getSession()
  if (!session) return

  await sql`
    UPDATE attendance
    SET
      logout_at = now(),
      duration_mins = ROUND(EXTRACT(EPOCH FROM (now() - login_at)) / 60)::integer
    WHERE id = ${attendanceId} AND user_id = ${session.id} AND logout_at IS NULL
  `
}
