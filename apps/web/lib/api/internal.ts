import { NextResponse } from "next/server"

import { getSession } from "@/lib/auth"

export async function requireInternalSession() {
  const session = await getSession()

  if (!session) {
    return {
      session: null,
      response: NextResponse.json(
        { statusCode: 401, error: "Unauthorized" },
        { status: 401 }
      ),
    }
  }

  return { session, response: null }
}

export function badRequest(error: string) {
  return NextResponse.json({ statusCode: 400, error }, { status: 400 })
}

export function notFound(error: string) {
  return NextResponse.json({ statusCode: 404, error }, { status: 404 })
}
