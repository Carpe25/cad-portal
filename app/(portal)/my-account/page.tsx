import { getSession } from "@/lib/session"
import { sql } from "@/lib/db"
import { redirect } from "next/navigation"
import UserSettingsForm from "./user-settings-form"

export default async function MyAccountPage() {
    // 1. Get the current logged-in session
    const session = await getSession()

    // 2. If no session, boot them to login
    if (!session) {
        redirect("/login")
    }

    // 3. Fetch the latest user data from the database
    // Note: Adjust 'session.id' if your session uses a different property name for the user ID
    const users = await sql`
    SELECT id, name, email 
    FROM users 
    WHERE id = ${session.id}
  `

    if (users.length === 0) {
        redirect("/login")
    }

    const user = {
        id: users[0].id,
        name: users[0].name,
        email: users[0].email,
    }

    // 4. Pass the fetched user down to the Client Component
    return <UserSettingsForm user={user} />
}