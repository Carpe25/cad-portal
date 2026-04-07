import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { sql } from "@/lib/db"
import { CreateTaskForm } from "./create-task-form"

export default async function NewTaskPage() {
  const session = await getSession()
  if (!session || (!session.roles.includes("manager") && !session.roles.includes("qc"))) redirect("/dashboard")

  const designers = await sql`
    SELECT id, name FROM users
    WHERE active = true AND roles @> ARRAY['designer']::text[]
    ORDER BY name ASC
  `

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="font-heading text-xl font-semibold">Create Task</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Add a new CAD task and assign it to a designer.
        </p>
      </div>
      <CreateTaskForm designers={designers as { id: string; name: string }[]} />
    </div>
  )
}
