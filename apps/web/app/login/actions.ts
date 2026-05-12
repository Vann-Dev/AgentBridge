"use server"

import bcrypt from "bcryptjs"
import { redirect } from "next/navigation"

import { createAuditLog } from "@/lib/api/audit-log"
import { createSession } from "@/lib/auth"
import {
  checkLoginThrottle,
  clearLoginThrottle,
  formatLoginThrottleMessage,
  getLoginThrottleTarget,
  recordFailedLoginAttempt,
} from "@/lib/auth/login-protection"
import { prisma } from "@/lib/prisma"

const invalidLoginMessage = "Invalid username or password."

export async function login(_state: string | null, formData: FormData) {
  const username = String(formData.get("username") ?? "").trim()
  const password = String(formData.get("password") ?? "")

  if (!username || !password) {
    return "Enter username and password."
  }

  const throttleTarget = await getLoginThrottleTarget(username)
  const throttle = await checkLoginThrottle(throttleTarget)
  const throttleMessage = formatLoginThrottleMessage(throttle)

  if (throttleMessage) {
    await createLoginAuditLog({
      username,
      action: "auth.login.throttled",
      details: "Rejected login attempt while throttle was active.",
    })

    return throttleMessage
  }

  const user = await prisma.user.findUnique({
    where: { username },
  })
  const isValidPassword = user
    ? await bcrypt.compare(password, user.passwordHash)
    : false

  if (!user || !isValidPassword) {
    await recordFailedLoginAttempt(throttleTarget)
    await createLoginAuditLog({
      username: user?.username ?? username,
      userId: user?.id,
      action: "auth.login.failed",
      details: "Failed login attempt.",
    })

    return invalidLoginMessage
  }

  await clearLoginThrottle(throttleTarget)
  await createLoginAuditLog({
    username: user.username,
    userId: user.id,
    action: "auth.login.succeeded",
    details: "Successful login.",
  })
  await createSession({ userId: user.id, username: user.username })
  redirect("/dashboard")
}

type LoginAuditInput = {
  username: string
  userId?: string
  action: string
  details: string
}

async function createLoginAuditLog({ username, userId, action, details }: LoginAuditInput) {
  const companies = userId
    ? await prisma.company.findMany({
        where: { userId },
        select: { id: true },
      })
    : []

  if (companies.length === 0) {
    console.info(`[auth] ${action}`, { username })
    return
  }

  await Promise.all(
    companies.map((company) =>
      createAuditLog({
        companyId: company.id,
        action,
        target: { type: "auth", id: null, name: username },
        actor: { type: "user", id: userId ?? null, name: username },
        details,
      })
    )
  )
}
