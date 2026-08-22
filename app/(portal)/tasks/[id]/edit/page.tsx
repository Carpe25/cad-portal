import { notFound, redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { sql } from "@/lib/db"
import { PageHeader } from "@/components/portal/page-header"
import { EditTaskForm, TaskData } from "./edit-task-form"

export default async function EditTaskPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const session = await getSession()
  if (!session) redirect("/login")

  const isManager = session.roles.includes("manager")
  if (!isManager) redirect("/tasks")

  const cleanId = decodeURIComponent(id.trim())
  const taskRows = await sql`
    SELECT * FROM tasks
    WHERE LOWER(id::text) = LOWER(${cleanId})
       OR LOWER(readable_id) = LOWER(${cleanId})
       OR REPLACE(id::text, '-', '') = LOWER(REPLACE(${cleanId}, '-', ''))
  `

  if (!taskRows.length) notFound()
  const rawTask = taskRows[0] as any

  const task: TaskData = {
    id: String(rawTask.id),
    readable_id: String(rawTask.readable_id || ""),
    title: String(rawTask.title || ""),
    client_name: String(rawTask.client_name || ""),
    customer_project_no: rawTask.customer_project_no ? String(rawTask.customer_project_no) : null,
    speed: rawTask.speed ? String(rawTask.speed) : null,
    customer_code: rawTask.customer_code ? String(rawTask.customer_code) : null,
    category_code: rawTask.category_code ? String(rawTask.category_code) : null,
    complexity: rawTask.complexity ? String(rawTask.complexity) : null,
    work_type: rawTask.work_type ? String(rawTask.work_type) : null,
    version: rawTask.version ? String(rawTask.version) : null,
    sr_no: rawTask.sr_no ? String(rawTask.sr_no) : null,
    cd_project_no: rawTask.cd_project_no ? String(rawTask.cd_project_no) : null,
    request_date: rawTask.request_date ? String(rawTask.request_date) : null,
    reference_image: rawTask.reference_image ? String(rawTask.reference_image) : null,
    style_ref_number: rawTask.style_ref_number ? String(rawTask.style_ref_number) : null,
    description: rawTask.description ? String(rawTask.description) : null,
    points: Number(rawTask.points || 0),
    status: String(rawTask.status || "assigned"),
    priority: String(rawTask.priority || "medium"),
    deadline: rawTask.deadline ? String(rawTask.deadline) : null,
    drive_folder_link: rawTask.drive_folder_link ? String(rawTask.drive_folder_link) : null,
    assigned_to: rawTask.assigned_to ? String(rawTask.assigned_to) : null,
    deliverables: rawTask.deliverables ? String(rawTask.deliverables) : null,
  }

  const [rawDesigners, rawCustomers] = await Promise.all([
    sql`
      SELECT id, name FROM users
      WHERE active = true AND roles @> ARRAY['designer']::text[]
      ORDER BY name ASC
    `,
    sql`
      SELECT uuid, code, name FROM customer
      ORDER BY code ASC
    `,
  ])

  const designers = rawDesigners.map((d: any) => ({
    id: String(d.id),
    name: String(d.name),
  }))
  const customers = rawCustomers.map((c: any) => ({
    uuid: String(c.uuid),
    code: String(c.code),
    name: String(c.name),
  }))

  return (
    <main className="min-h-full">
      <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <PageHeader
          roleLabel="Task Management"
          title={`Edit Task: ${task.customer_project_no || task.cd_project_no || task.title}`}
          description="Update task parameters, assignment, speed, and deadlines."
        />
        <div className="mt-6">
          <EditTaskForm
            task={task}
            designers={designers}
            customers={customers}
          />
        </div>
      </div>
    </main>
  )
}
