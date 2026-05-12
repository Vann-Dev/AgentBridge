import { NextResponse } from "next/server"

import { createAuditLog } from "@/lib/api/audit-log"
import { projectAgentSelect, serializeProjectAgents } from "@/lib/api/project-agents"
import { badRequest, notFound, requireInternalSession } from "@/lib/api/internal"
import { prisma } from "@/lib/prisma"

type RouteContext = {
  params: Promise<{ projectId: string }>
}

export async function PUT(request: Request, { params }: RouteContext) {
  const { session, response } = await requireInternalSession()

  if (response) return response

  const body = (await request.json().catch(() => null)) as { agentIds?: unknown } | null
  const agentIds = parseStringIds(body?.agentIds)

  if (!agentIds) {
    return badRequest("Invalid project agents.")
  }

  const { projectId } = await params
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      company: { userId: session.userId },
    },
    select: {
      id: true,
      name: true,
      companyId: true,
      agents: {
        select: {
          agent: {
            select: { id: true, name: true },
          },
        },
      },
    },
  })

  if (!project) {
    return notFound("Project not found.")
  }

  const agents = agentIds.length
    ? await prisma.agent.findMany({
        where: {
          id: { in: agentIds },
          companyId: project.companyId,
          company: { userId: session.userId },
        },
        select: { id: true, name: true },
      })
    : []

  if (agents.length !== agentIds.length) {
    return badRequest("Project agent not found.")
  }

  const previousAgentIds = new Set(project.agents.map(({ agent }) => agent.id))
  const nextAgentIds = new Set(agentIds)
  const removedAgentNames = project.agents
    .filter(({ agent }) => !nextAgentIds.has(agent.id))
    .map(({ agent }) => agent.name)
  const addedAgentNames = agents
    .filter((agent) => !previousAgentIds.has(agent.id))
    .map((agent) => agent.name)

  const projectAgents = await prisma.$transaction(async (tx: typeof prisma) => {
    await tx.projectAgent.deleteMany({
      where: {
        projectId: project.id,
        agentId: { notIn: agentIds },
      },
    })

    if (agentIds.length) {
      await tx.projectAgent.createMany({
        data: agentIds.map((agentId) => ({ projectId: project.id, agentId })),
        skipDuplicates: true,
      })
    }

    return tx.projectAgent.findMany({
      where: { projectId: project.id },
      orderBy: { agent: { name: "asc" } },
      select: projectAgentSelect,
    })
  })

  await createAuditLog({
    companyId: project.companyId,
    action: "project.agents.updated",
    target: { type: "project", id: project.id, name: project.name },
    actor: { type: "user", id: session.userId, name: session.username },
    details: formatProjectAgentChanges(addedAgentNames, removedAgentNames),
  })

  return NextResponse.json({
    statusCode: 200,
    projectAgents: serializeProjectAgents(projectAgents),
  })
}

function parseStringIds(value: unknown) {
  if (!Array.isArray(value)) return null

  const ids = value.filter((item): item is string => typeof item === "string" && Boolean(item))

  return ids.length === value.length ? Array.from(new Set(ids)) : null
}

function formatProjectAgentChanges(added: string[], removed: string[]) {
  const changes = [
    added.length ? `Added ${added.join(", ")}` : null,
    removed.length ? `Removed ${removed.join(", ")}` : null,
  ].filter(Boolean)

  return changes.length ? `${changes.join("; ")}.` : "Project agents unchanged."
}
