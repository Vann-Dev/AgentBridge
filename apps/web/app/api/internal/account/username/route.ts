import bcrypt from "bcryptjs"
import { NextResponse } from "next/server"

import { createSession } from "@/lib/auth"
import { badRequest, requireInternalSession } from "@/lib/api/internal"
import { prisma } from "@/lib/prisma"

export async function PUT(request: Request) {
  const { session, response } = await requireInternalSession()

  if (response) return response

  const body = (await request.json().catch(() => null)) as {
    username?: unknown
    password?: unknown
  } | null

  const username = typeof body?.username === "string" ? body.username.trim() : ""
  const password = typeof body?.password === "string" ? body.password : ""

  if (!username || !password) {
    return badRequest("Username and password are required.")
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
  })

  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return badRequest("Password is incorrect.")
  }

  const existingUser = await prisma.user.findUnique({
    where: { username },
  })

  if (existingUser && existingUser.id !== session.userId) {
    return badRequest("Username is already taken.")
  }

  await prisma.user.update({
    where: { id: session.userId },
    data: { username },
  })
  await createSession({ userId: session.userId, username })

  return NextResponse.json({ statusCode: 200 })
}
