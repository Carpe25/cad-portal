import postgres from "postgres"

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set")
}

const sql = postgres(process.env.DATABASE_URL, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
})

/** postgres.js returns RowList; normalize to a typed plain array for app code */
export function rows<T>(result: postgres.RowList<postgres.Row[]>): T[] {
  return result as unknown as T[]
}

export { sql }
