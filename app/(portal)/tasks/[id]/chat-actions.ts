'use server'

import { sql } from '@/lib/db'

export interface TaskChatMessage {
  id: string
  task_id: string
  user_id: string
  user_name: string
  user_email: string | null
  content: string
  created_at: string
}

async function ensureMessagesTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS task_messages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      task_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      user_name TEXT NOT NULL,
      user_email TEXT,
      content TEXT NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `
  await sql`
    CREATE INDEX IF NOT EXISTS idx_task_messages_task_id 
    ON task_messages(task_id, created_at ASC);
  `
}

export async function getTaskMessages(taskId: string): Promise<TaskChatMessage[]> {
  try {
    await ensureMessagesTable()

    const rows = await sql`
      SELECT 
        id::text,
        task_id,
        user_id,
        user_name,
        user_email,
        content,
        created_at
      FROM task_messages
      WHERE task_id = ${taskId}
      ORDER BY created_at ASC
    `

    return rows.map((r: any) => ({
      id: r.id,
      task_id: r.task_id,
      user_id: r.user_id,
      user_name: r.user_name,
      user_email: r.user_email,
      content: r.content,
      created_at: new Date(r.created_at).toISOString(),
    }))
  } catch (error) {
    console.error("Error fetching task messages from Neon DB:", error)
    return []
  }
}

export async function saveTaskMessage(
  taskId: string,
  userId: string,
  userName: string,
  userEmail: string | null,
  content: string
): Promise<TaskChatMessage | null> {
  try {
    await ensureMessagesTable()

    const [inserted] = await sql`
      INSERT INTO task_messages (task_id, user_id, user_name, user_email, content)
      VALUES (${taskId}, ${userId}, ${userName}, ${userEmail}, ${content})
      RETURNING id::text, task_id, user_id, user_name, user_email, content, created_at
    `

    if (!inserted) return null

    return {
      id: inserted.id,
      task_id: inserted.task_id,
      user_id: inserted.user_id,
      user_name: inserted.user_name,
      user_email: inserted.user_email,
      content: inserted.content,
      created_at: new Date(inserted.created_at).toISOString(),
    }
  } catch (error) {
    console.error("Error saving task message to Neon DB:", error)
    return null
  }
}
