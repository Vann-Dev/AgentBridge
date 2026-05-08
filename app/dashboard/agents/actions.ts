"use server"

import { createHash, randomBytes } from "node:crypto"

import { revalidatePath } from "next/cache"

import { getSession } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

type CreateAgentResult =
  | { error: string; token?: never }
  | { error: null; token: string }

type AgentActionResult =
  | { error: string; token?: never }
  | { error: null; token?: string }

function generateToken() {
  const token = `agt_${randomBytes(32).toString("base64url")}`
  const bearerTokenHash = createHash("sha256").update(token).digest("hex")

  return { token, bearerTokenHash }
}

export async function createAgent(
  _state: CreateAgentResult | null,
  formData: FormData
): Promise<CreateAgentResult> {
  const session = await getSession()

  if (!session) {
    return { error: "You must be signed in." }
  }

  const companyId = String(formData.get("companyId") ?? "")
  const name = String(formData.get("name") ?? "").trim()
  const description = String(formData.get("description") ?? "").trim()
  const position = String(formData.get("position") ?? "").trim()

  if (!companyId || !name || !position) {
    return { error: "Company, name, and position are required." }
  }

  const company = await prisma.company.findFirst({
    where: {
      id: companyId,
      userId: session.userId,
    },
  })

  if (!company) {
    return { error: "Company not found." }
  }

  const { token, bearerTokenHash } = generateToken()

  await prisma.agent.create({
    data: {
      name,
      description,
      position,
      bearerTokenHash,
      companyId,
    },
  })

  revalidatePath("/dashboard/agents")

  return { error: null, token }
}

async function getOwnedAgent(agentId: string, userId: string) {
  return prisma.agent.findFirst({
    where: {
      id: agentId,
      company: {
        userId,
      },
    },
  })
}

export async function deleteAgent(
  _state: AgentActionResult | null,
  formData: FormData
): Promise<AgentActionResult> {
  const session = await getSession()

  if (!session) {
    return { error: "You must be signed in." }
  }

  const agentId = String(formData.get("agentId") ?? "")

  if (!agentId) {
    return { error: "Agent is required." }
  }

  const agent = await getOwnedAgent(agentId, session.userId)

  if (!agent) {
    return { error: "Agent not found." }
  }

  await prisma.agent.delete({
    where: { id: agent.id },
  })

  revalidatePath("/dashboard/agents")

  return { error: null }
}

export async function regenerateAgentToken(
  _state: AgentActionResult | null,
  formData: FormData
): Promise<AgentActionResult> {
  const session = await getSession()

  if (!session) {
    return { error: "You must be signed in." }
  }

  const agentId = String(formData.get("agentId") ?? "")

  if (!agentId) {
    return { error: "Agent is required." }
  }

  const agent = await getOwnedAgent(agentId, session.userId)

  if (!agent) {
    return { error: "Agent not found." }
  }

  const { token, bearerTokenHash } = generateToken()

  await prisma.agent.update({
    where: { id: agent.id },
    data: { bearerTokenHash },
  })

  revalidatePath("/dashboard/agents")

  return { error: null, token }
}
