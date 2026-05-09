import bcrypt from "bcryptjs"
import { NextResponse } from "next/server"

import { badRequest, requireInternalSession } from "@/lib/api/internal"
import { prisma } from "@/lib/prisma"

export async function PUT(request: Request) {
  const { session, response } = await requireInternalSession()

  if (response) return response

  const body = (await request.json().catch(() => null)) as {
    currentPassword?: unknown
    newPassword?: unknown
  } | null

  const currentPassword = typeof body?.currentPassword === "string" ? body.currentPassword : ""
  const newPassword = typeof body?.newPassword === "string" ? body.newPassword : ""

  if (!currentPassword || !newPassword) {
    return badRequest("Current password and new password are required.")
  }

  if (newPassword.length < 8) {
    return badRequest("New password must be at least 8 characters.")
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
  })

  if (!user || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
    return badRequest("Current password is incorrect.")
  }

  const passwordHash = await bcrypt.hash(newPassword, 12)

  await prisma.user.update({
    where: { id: session.userId },
    data: { passwordHash },
  })

  return NextResponse.json({ statusCode: 200 })
}
