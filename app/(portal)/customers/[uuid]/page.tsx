import { Suspense } from "react"
import { notFound, redirect } from "next/navigation"
import { sql } from "@/lib/db"
import { getSession } from "@/lib/session"
import { PageHeader } from "@/components/portal/page-header"
import { CustomerReportView } from "./customer-report-view"
import { ensureTaskTableColumns } from "@/app/(portal)/tasks/new/actions"

interface Customer {
  uuid: string
  code: string
  name: string
  created_at: string
}

export interface TaskHistorySubmission {
  id: string
  task_id: string
  version: string
  drive_link: string | null
  outcome: string
  designer_notes: string | null
  remarks: string | null
  submitted_at: string
  submitter_name: string | null
  reviewer_name: string | null
}

export interface CustomerTaskReportItem {
  id: string
  readable_id: string | null
  title: string
  client_name: string
  style_ref_number: string | null
  description: string | null
  points: number
  priority: string
  speed: string | null
  status: string
  customer_project_no: string | null
  cd_project_no: string | null
  customer_code: string | null
  category_code: string | null
  complexity: string | null
  work_type: string | null
  version: string | null
  sr_no: string | null
  request_date: string | null
  deadline: string | null
  created_at: string
  closed_at: string | null
  designer_name: string | null
  submissions: TaskHistorySubmission[]
}

interface PageProps {
  params: Promise<{ uuid: string }>
}

export default async function CustomerMonthlyReportPage({ params }: PageProps) {
  const session = await getSession()
  if (!session) redirect("/login")

  const isManager = session.roles.includes("manager")
  if (!isManager) redirect("/dashboard")

  const { uuid } = await params

  const customerRows = (await sql`
    SELECT uuid, code, name, created_at
    FROM customer
    WHERE uuid = ${uuid}
  `) as Customer[]

  if (!customerRows.length) {
    notFound()
  }

  const customer = customerRows[0]

  // Ensure database columns (including closed_at) exist on tasks table
  await ensureTaskTableColumns()

  // Fetch all tasks for this customer (matching customer_code or client_name)
  const taskRows = (await sql`
    SELECT
      t.id,
      t.readable_id,
      t.title,
      t.client_name,
      t.style_ref_number,
      t.description,
      t.points,
      t.priority,
      t.speed,
      t.status,
      t.customer_project_no,
      t.cd_project_no,
      t.customer_code,
      t.category_code,
      t.complexity,
      t.work_type,
      t.version,
      t.sr_no,
      t.request_date,
      t.deadline,
      t.created_at,
      t.closed_at,
      u.name AS designer_name
    FROM tasks t
    LEFT JOIN users u ON t.assigned_to = u.id
    WHERE (t.customer_code = ${customer.code} OR LOWER(t.client_name) = LOWER(${customer.name}))
    ORDER BY COALESCE(t.closed_at, t.created_at) DESC
  `) as any[]

  // Fetch submissions history for these tasks
  const taskIds = taskRows.map((t) => t.id)
  let submissionsByTaskId: Record<string, TaskHistorySubmission[]> = {}

  if (taskIds.length > 0) {
    const submissionRows = (await sql`
      SELECT
        s.id,
        s.task_id,
        s.version,
        s.drive_link,
        s.outcome,
        s.designer_notes,
        s.remarks,
        s.submitted_at,
        u.name AS submitter_name,
        r.name AS reviewer_name
      FROM submissions s
      LEFT JOIN users u ON s.submitted_by = u.id
      LEFT JOIN users r ON s.reviewed_by = r.id
      WHERE s.task_id = ANY(${taskIds})
      ORDER BY s.submitted_at ASC
    `) as TaskHistorySubmission[]

    for (const sub of submissionRows) {
      if (!submissionsByTaskId[sub.task_id]) {
        submissionsByTaskId[sub.task_id] = []
      }
      submissionsByTaskId[sub.task_id].push(sub)
    }
  }

  const tasks: CustomerTaskReportItem[] = taskRows.map((t) => ({
    id: t.id,
    readable_id: t.readable_id,
    title: t.title,
    client_name: t.client_name,
    style_ref_number: t.style_ref_number,
    description: t.description,
    points: t.points ? Number(t.points) : 0,
    priority: t.priority,
    speed: t.speed,
    status: t.status,
    customer_project_no: t.customer_project_no,
    cd_project_no: t.cd_project_no,
    customer_code: t.customer_code,
    category_code: t.category_code,
    complexity: t.complexity,
    work_type: t.work_type,
    version: t.version,
    sr_no: t.sr_no,
    request_date: t.request_date,
    deadline: t.deadline,
    created_at: t.created_at,
    closed_at: t.closed_at,
    designer_name: t.designer_name,
    submissions: submissionsByTaskId[t.id] || [],
  }))

  return (
    <main className="min-h-full">
      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <PageHeader
          roleLabel="Manager Report"
          title={`Monthly Report: ${customer.name}`}
          description={`Customer Code: ${customer.code} • Comprehensive task & completion analytics.`}
        />
        <CustomerReportView customer={customer} initialTasks={tasks} />
      </div>
    </main>
  )
}
