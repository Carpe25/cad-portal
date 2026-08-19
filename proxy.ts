import { jwtVerify } from "jose"
import { NextRequest, NextResponse } from "next/server"

const SECRET = new TextEncoder().encode(
  process.env.SESSION_SECRET ?? "fallback-secret-change-me"
)

const PUBLIC_PATHS = ["/login", "/api/setup"]

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  const token = req.cookies.get("cad_session")?.value

  if (!token) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Session expired. Please log in again." }, { status: 401 })
    }
    return NextResponse.redirect(new URL("/login", req.url))
  }

  try {
    await jwtVerify(token, SECRET)
    return NextResponse.next()
  } catch {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Session expired. Please log in again." }, { status: 401 })
    }
    return NextResponse.redirect(new URL("/login", req.url))
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
