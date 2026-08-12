import { neon } from "@neondatabase/serverless"

const databaseUrl = "postgresql://neondb_owner:npg_mf6ucYqb8GJX@ep-weathered-pine-amv8hhtk-pooler.c-5.us-east-1.aws.neon.tech/neondb?channel_binding=require&sslmode=require"
const sql = neon(databaseUrl)

async function run() {
  try {
    console.log("Altering deadline column type to TIMESTAMPTZ...")
    await sql`
      ALTER TABLE tasks
      ALTER COLUMN deadline TYPE TIMESTAMPTZ USING deadline::timestamptz;
    `
    console.log("Column deadline successfully altered to TIMESTAMPTZ!")

    console.log("Updating active tasks created in last 7 days to created_at + 24 hours...")
    await sql`
      UPDATE tasks
      SET deadline = created_at + INTERVAL '24 hours'
      WHERE created_at >= NOW() - INTERVAL '7 days'
        AND status IN ('assigned', 'in_progress', 'revision_requested');
    `
    console.log("Active task deadlines successfully updated!")

    const updatedTasks = await sql`
      SELECT id, readable_id, title, category_code, request_date, deadline, created_at, assigned_at, status
      FROM tasks
      ORDER BY created_at DESC
      LIMIT 5;
    `
    console.log("Updated tasks in DB:", JSON.stringify(updatedTasks, null, 2))
  } catch (err) {
    console.error("Error:", err)
  }
}

run()
