import { NextResponse, type NextRequest } from "next/server"
import { jwtVerify } from "jose"

const sessionCookieName = "agentbridge_session"

async function hasValidSession(request: NextRequest) {
  const token = request.cookies.get(sessionCookieName)?.value
  const secret = process.env.AUTH_SECRET

  if (!token || !secret) {
    return false
  }

  try {
    await jwtVerify(token, new TextEncoder().encode(secret))
    return true
  } catch {
    return false
  }
}

export async function middleware(request: NextRequest) {
  const isAuthenticated = await hasValidSession(request)
  const isLoginPage = request.nextUrl.pathname === "/login"
  const isSetupPage = request.nextUrl.pathname === "/setup"

  if (!isAuthenticated && !isLoginPage && !isSetupPage) {
    return NextResponse.redirect(new URL("/login", request.url))
  }

  if (isAuthenticated && (isLoginPage || isSetupPage)) {
    return NextResponse.redirect(new URL("/dashboard", request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
}
