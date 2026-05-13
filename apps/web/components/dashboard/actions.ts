"use server"

import { revalidatePath } from "next/cache"

import { getSession } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { generateCompanyBearerToken } from "@/lib/token"

type ActionResult<T> = ({ ok: true } & T) | { ok: false; error: string }

export async function createCompanyAction(payload: {
  name: string
  description: string
}): Promise<ActionResult<{ company: { id: string }; token: string }>> {
  const session = await getSession()

  if (!session) {
    return { ok: false, error: "Unauthorized" }
  }

  const name = payload.name.trim()
  const description = payload.description.trim()

  if (!name) {
    return { ok: false, error: "Company name is required." }
  }

  const { token, bearerTokenHash } = generateCompanyBearerToken()
  const company = await prisma.company.create({
    data: {
      name,
      description,
      userId: session.userId,
      bearerTokenHash,
    },
    select: { id: true },
  })

  revalidatePath("/dashboard")
  revalidatePath("/dashboard/projects")
  revalidatePath("/dashboard/agents")
  revalidatePath("/dashboard/settings")

  return { ok: true, company, token }
}
