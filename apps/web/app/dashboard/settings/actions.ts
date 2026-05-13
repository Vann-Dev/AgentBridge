"use server"

import { revalidatePath } from "next/cache"

import bcrypt from "bcryptjs"

import { createAuditLog } from "@/lib/api/audit-log"
import { invalidateCompanyCache } from "@/lib/api/cache"
import { createSession, getSession } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { generateCompanyBearerToken } from "@/lib/token"

type ActionResult<T = object> = ({ ok: true } & T) | { ok: false; error: string }

type CompanyRow = {
  id: string
  name: string
  description: string
}

export async function updateCompanyAction(
  companyId: string,
  payload: { name: string; description: string }
): Promise<ActionResult<{ company: CompanyRow }>> {
  const session = await getSession()

  if (!session) {
    return { ok: false, error: "Unauthorized" }
  }

  const name = payload.name.trim()
  const description = payload.description.trim()

  if (!name) {
    return { ok: false, error: "Company name is required." }
  }

  const company = await prisma.company.findFirst({
    where: { id: companyId, userId: session.userId },
  })

  if (!company) {
    return { ok: false, error: "Company not found." }
  }

  const updatedCompany = await prisma.company.update({
    where: { id: company.id },
    data: { name, description },
    select: { id: true, name: true, description: true },
  })

  await invalidateAndRevalidate(company.id)

  return { ok: true, company: updatedCompany }
}

export async function deleteCompanyAction(
  companyId: string,
  confirmationName: string
): Promise<ActionResult<{ companyId: string }>> {
  const session = await getSession()

  if (!session) {
    return { ok: false, error: "Unauthorized" }
  }

  const company = await prisma.company.findFirst({
    where: { id: companyId, userId: session.userId },
  })

  if (!company) {
    return { ok: false, error: "Company not found." }
  }

  if (confirmationName.trim() !== company.name) {
    return { ok: false, error: "Type the company name exactly to delete this company." }
  }

  await prisma.company.delete({ where: { id: company.id } })
  revalidatePath("/dashboard")
  revalidatePath("/dashboard/projects")
  revalidatePath("/dashboard/agents")
  revalidatePath("/dashboard/settings")

  return { ok: true, companyId: company.id }
}

export async function rotateCompanyTokenAction(
  companyId: string
): Promise<ActionResult<{ token: string }>> {
  const session = await getSession()

  if (!session) {
    return { ok: false, error: "Unauthorized" }
  }

  const company = await prisma.company.findFirst({
    where: { id: companyId, userId: session.userId },
  })

  if (!company) {
    return { ok: false, error: "Company not found." }
  }

  const { token, bearerTokenHash } = generateCompanyBearerToken()

  await prisma.company.update({
    where: { id: company.id },
    data: { bearerTokenHash },
  })

  await createAuditLog({
    companyId: company.id,
    action: "company.token_rotated",
    target: { type: "company", id: company.id, name: company.name },
    actor: { type: "user", id: session.userId, name: session.username },
    details:
      "Rotated the company bearer token. Existing external agent configs must be updated.",
  })
  await invalidateAndRevalidate(company.id)

  return { ok: true, token }
}

export async function changePasswordAction(payload: {
  currentPassword: string
  newPassword: string
}): Promise<ActionResult> {
  const session = await getSession()

  if (!session) {
    return { ok: false, error: "Unauthorized" }
  }

  const currentPassword = payload.currentPassword
  const newPassword = payload.newPassword

  if (!currentPassword || !newPassword) {
    return { ok: false, error: "Current password and new password are required." }
  }

  if (newPassword.length < 8) {
    return { ok: false, error: "New password must be at least 8 characters." }
  }

  const user = await prisma.user.findUnique({ where: { id: session.userId } })

  if (!user || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
    return { ok: false, error: "Current password is incorrect." }
  }

  const passwordHash = await bcrypt.hash(newPassword, 12)
  await prisma.user.update({
    where: { id: session.userId },
    data: { passwordHash },
  })

  return { ok: true }
}

export async function changeUsernameAction(payload: {
  username: string
  password: string
}): Promise<ActionResult> {
  const session = await getSession()

  if (!session) {
    return { ok: false, error: "Unauthorized" }
  }

  const username = payload.username.trim()
  const password = payload.password

  if (!username || !password) {
    return { ok: false, error: "Username and password are required." }
  }

  const user = await prisma.user.findUnique({ where: { id: session.userId } })

  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return { ok: false, error: "Password is incorrect." }
  }

  const existingUser = await prisma.user.findUnique({ where: { username } })

  if (existingUser && existingUser.id !== session.userId) {
    return { ok: false, error: "Username is already taken." }
  }

  await prisma.user.update({ where: { id: session.userId }, data: { username } })
  await createSession({ userId: session.userId, username })
  revalidatePath("/dashboard")

  return { ok: true }
}

async function invalidateAndRevalidate(companyId: string) {
  await invalidateCompanyCache(companyId)
  revalidatePath("/dashboard")
  revalidatePath("/dashboard/projects")
  revalidatePath("/dashboard/agents")
  revalidatePath("/dashboard/settings")
}
