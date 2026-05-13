"use server"

import { revalidatePath } from "next/cache"

import { Prisma } from "@/generated/prisma/client"
import { createAuditLog, formatChangedFields } from "@/lib/api/audit-log"
import { invalidateCompanyCache } from "@/lib/api/cache"
import { getSession } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

type AgentActionResult = {
  error?: string
}

async function requireDashboardSession() {
  const session = await getSession()

  if (!session) {
    throw new Error("Unauthorized")
  }

  return session
}

function revalidateDashboardAgentPaths(companyId?: string | null) {
  revalidatePath("/dashboard")
  revalidatePath("/dashboard/agents")
  revalidatePath("/dashboard/projects")
  if (companyId) {
    revalidatePath(`/dashboard/agents?company=${companyId}`)
    revalidatePath(`/dashboard/projects?company=${companyId}`)
  }
}

export async function createAgentAction(_previousState: AgentActionResult, formData: FormData) {
  const session = await requireDashboardSession()

  const companyId = String(formData.get("companyId") ?? "")
  const AgentId = String(formData.get("AgentId") ?? "").trim()
  const name = String(formData.get("name") ?? "").trim()
  const description = String(formData.get("description") ?? "").trim()
  const position = String(formData.get("position") ?? "").trim()

  if (!companyId || !AgentId || !name || !position) {
    return { error: "Company, AgentId, name, and position are required." }
  }

  const company = await prisma.company.findFirst({
    where: { id: companyId, userId: session.userId },
    select: { id: true },
  })

  if (!company) {
    return { error: "Company not found." }
  }

  const existingAgent = await prisma.agent.findUnique({
    where: { AgentId },
    select: { id: true },
  })

  if (existingAgent) {
    return { error: "AgentId is already in use." }
  }

  const agent = await prisma.agent
    .create({
      data: {
        companyId,
        AgentId,
        name,
        description,
        position,
      },
      select: {
        id: true,
        AgentId: true,
        name: true,
        description: true,
        position: true,
        companyId: true,
      },
    })
    .catch((error: unknown) => {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return null
      }

      throw error
    })

  if (!agent) {
    return { error: "AgentId is already in use." }
  }

  await createAuditLog({
    companyId,
    action: "agent.created",
    target: { type: "agent", id: agent.id, name: agent.name },
    actor: { type: "user", id: session.userId, name: session.username },
    details: `Created AgentId ${agent.AgentId}.`,
  })
  await invalidateCompanyCache(companyId)
  revalidateDashboardAgentPaths(companyId)

  return {}
}

export async function updateAgentAction(_previousState: AgentActionResult, formData: FormData) {
  const session = await requireDashboardSession()

  const agentId = String(formData.get("agentId") ?? "")
  const nextAgentId = String(formData.get("AgentId") ?? "").trim()
  const name = String(formData.get("name") ?? "").trim()
  const description = String(formData.get("description") ?? "").trim()
  const position = String(formData.get("position") ?? "").trim()

  if (!agentId) {
    return { error: "Agent is required." }
  }

  if (!nextAgentId || !name || !position) {
    return { error: "AgentId, name, and position cannot be empty." }
  }

  const agent = await prisma.agent.findFirst({
    where: {
      id: agentId,
      company: { userId: session.userId },
    },
  })

  if (!agent) {
    return { error: "Agent not found." }
  }

  if (nextAgentId !== agent.AgentId) {
    const existing = await prisma.agent.findUnique({
      where: { AgentId: nextAgentId },
      select: { id: true },
    })

    if (existing) {
      return { error: "AgentId is already in use." }
    }
  }

  const updatedAgent = await prisma.agent.update({
    where: { id: agent.id },
    data: {
      AgentId: nextAgentId,
      name,
      description,
      position,
    },
    select: {
      id: true,
      AgentId: true,
      name: true,
      description: true,
      position: true,
      companyId: true,
    },
  })

  await createAuditLog({
    companyId: agent.companyId,
    action: "agent.updated",
    target: { type: "agent", id: agent.id, name: updatedAgent.name },
    actor: { type: "user", id: session.userId, name: session.username },
    details: formatChangedFields([
      nextAgentId !== agent.AgentId && "AgentId",
      name !== agent.name && "name",
      description !== agent.description && "description",
      position !== agent.position && "position",
    ]),
  })
  await invalidateCompanyCache(agent.companyId)
  revalidateDashboardAgentPaths(agent.companyId)

  return {}
}

export async function deleteAgentAction(_previousState: AgentActionResult, formData: FormData) {
  const session = await requireDashboardSession()

  const agentId = String(formData.get("agentId") ?? "")

  if (!agentId) {
    return { error: "Agent is required." }
  }

  const agent = await prisma.agent.findFirst({
    where: {
      id: agentId,
      company: { userId: session.userId },
    },
  })

  if (!agent) {
    return { error: "Agent not found." }
  }

  await prisma.agent.delete({ where: { id: agent.id } })

  await createAuditLog({
    companyId: agent.companyId,
    action: "agent.deleted",
    target: { type: "agent", id: agent.id, name: agent.name },
    actor: { type: "user", id: session.userId, name: session.username },
    details: `Deleted AgentId ${agent.AgentId}.`,
  })
  await invalidateCompanyCache(agent.companyId)
  revalidateDashboardAgentPaths(agent.companyId)

  return {}
}
