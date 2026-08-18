import { Suspense } from "react"
import { getSession } from "@/lib/session"
import { redirect } from "next/navigation"
import { sql } from "@/lib/db"
import { ensureCustomerTable } from "./actions"
import { AddCustomerButton } from "./add-customer-button"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/components/portal/page-header"
import { Building2 } from "lucide-react"

import { EditCustomerButton } from "./edit-customer-button"

type Customer = {
  uuid: string
  code: string
  name: string
  created_at: string
}

export default async function CustomersPage() {
  const session = await getSession()
  if (!session) redirect("/login")

  const isManager = session.roles.includes("manager")
  const isQC = session.roles.includes("qc")
  if (!isManager && !isQC) redirect("/dashboard")

  return (
    <main className="min-h-full">
      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <PageHeader
          roleLabel="Directory"
          title="Customers"
          description="View and manage registered customers."
          action={<AddCustomerButton />}
        />
        <Suspense fallback={<CustomersSkeleton />}>
          <CustomersContent />
        </Suspense>
      </div>
    </main>
  )
}

async function CustomersContent() {
  await ensureCustomerTable()

  const customers = (await sql`
    SELECT uuid, code, name, created_at
    FROM customer
    ORDER BY created_at DESC
  `) as Customer[]

  return (
    <div className="mt-8 space-y-6">
      {/* Summary */}
      <p className="text-sm text-muted-foreground">
        {customers.length} customer{customers.length !== 1 ? "s" : ""} recorded
      </p>

      {/* Customers List / Table */}
      {customers.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/50 p-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Building2 className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="mt-4 font-heading text-lg font-semibold text-foreground">
            No customers yet
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Get started by adding your first customer using the button above.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
          {/* Header */}
          <div className="hidden items-center gap-4 border-b border-border bg-muted/30 px-4 py-2.5 text-xs font-medium text-muted-foreground md:grid md:grid-cols-[140px_minmax(0,1fr)_260px_140px_60px]">
            <span>Code</span>
            <span>Name</span>
            <span>UUID</span>
            <span>Date Added</span>
            <span className="text-right">Actions</span>
          </div>

          {/* Rows */}
          <div className="divide-y divide-border">
            {customers.map((c) => (
              <div
                key={c.uuid}
                className="flex flex-col gap-2 px-4 py-3.5 transition-colors hover:bg-muted/40 md:grid md:grid-cols-[140px_minmax(0,1fr)_260px_140px_60px] md:items-center md:gap-4"
              >
                {/* Code */}
                <div className="flex items-center gap-2">
                  <span className="inline-block rounded-md bg-muted px-2 py-0.5 font-mono text-xs font-semibold text-foreground">
                    {c.code}
                  </span>
                </div>

                {/* Name */}
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {c.name}
                  </p>
                </div>

                {/* UUID */}
                <div className="min-w-0">
                  <p className="truncate font-mono text-xs text-muted-foreground" title={c.uuid}>
                    {c.uuid}
                  </p>
                </div>

                {/* Date Added */}
                <div className="text-xs text-muted-foreground">
                  {new Date(c.created_at).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </div>

                {/* Edit Button */}
                <div className="flex items-center justify-end">
                  <EditCustomerButton customer={c} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function CustomersSkeleton() {
  return (
    <div className="mt-8 space-y-8">
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  )
}
