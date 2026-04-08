import { getSession } from "@/lib/session"
import { sql } from "@/lib/db"
import { redirect } from "next/navigation"
import { PageHeader } from "@/components/portal/page-header"
import UserSettingsForm from "./user-settings-form"

export default async function MyAccountPage() {
  const session = await getSession()
  if (!session) redirect("/login")

  const users = await sql`
    SELECT id, name, email
    FROM users
    WHERE id = ${session.id}
  `
  if (users.length === 0) redirect("/login")

  const user = {
    id: users[0].id,
    name: users[0].name,
    email: users[0].email,
  }

  return (
    <main className="min-h-full">
      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <PageHeader
          title="Account Settings"
          description="Manage your profile and security."
        />
        <UserSettingsForm user={user} />
      </div>
    </main>
  )
}