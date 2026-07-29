import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { sql } from "@/lib/db"
import { ensureCustomerTable } from "@/app/(portal)/customers/actions"
import { CreateTaskForm } from "./create-task-form"
import { PageHeader } from "@/components/portal/page-header"

export default async function NewTaskPage() {
  const session = await getSession()
  if (
    !session ||
    (!session.roles.includes("manager") && !session.roles.includes("qc"))
  )
    redirect("/dashboard")

  const rawDesigners = await sql`
    SELECT id, name FROM users
    WHERE active = true AND roles @> ARRAY['designer']::text[]
    ORDER BY name ASC
  `
  const designers = rawDesigners.map((d: any) => ({
    id: String(d.id),
    name: String(d.name),
  }))

  await ensureCustomerTable()
  const rawCustomers = await sql`
    SELECT uuid, code, name FROM customer ORDER BY name ASC
  `
  const customers = rawCustomers.map((c: any) => ({
    uuid: String(c.uuid),
    code: String(c.code),
    name: String(c.name),
  }))

  const countRes = await sql`SELECT COUNT(*) as count FROM tasks`
  const nextSrNoCount = Number(countRes[0]?.count || 0) + 1

  return (
    <main className="min-h-full">
      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <PageHeader
          roleLabel="New"
          title="Create Task"
          description="Add a new CAD task and assign it to a designer."
        />
        <div className="mt-8 max-w-2xl">
          <CreateTaskForm
            designers={designers as { id: string; name: string }[]}
            customers={customers}
            nextSrNoCount={nextSrNoCount}
          />
        </div>
      </div>
    </main>
  )
}

