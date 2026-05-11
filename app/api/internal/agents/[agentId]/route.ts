import { NextResponse } from "next/server"

import { createAuditLog, formatChangedFields } from "@/lib/api/audit-log"
import {
  badRequest,
  notFound,
  requireInternalSession,
} from "@/lib/api/internal"
import { prisma } from "@/lib/prisma"

type RouteContext = {
  params: Promise<{ agentId: string }>
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const { session, response } = await requireInternalSession()

  if (response) return response

  const body = (await request.json().catch(() => null)) as {
    AgentId?: unknown
    name?: unknown
    description?: unknown
    position?: unknown
  } | null

  const nextAgentId =
    typeof body?.AgentId === "string" ? body.AgentId.trim() : undefined
  const name = typeof body?.name === "string" ? body.name.trim() : undefined
  const description =
    typeof body?.description === "string" ? body.description.trim() : undefined
  const position =
    typeof body?.position === "string" ? body.position.trim() : undefined

  if (nextAgentId === "" || name === "" || position === "") {
    return badRequest("AgentId, name, and position cannot be empty.")
  }

  if (
    nextAgentId === undefined &&
    name === undefined &&
    description === undefined &&
    position === undefined
  ) {
    return badRequest("No agent changes provided.")
  }

  const { agentId } = await params
  const agent = await prisma.agent.findFirst({
    where: {
      id: agentId,
      company: { userId: session.userId },
    },
  })

  if (!agent) {
    return notFound("Agent not found.")
  }

  if (nextAgentId && nextAgentId !== agent.AgentId) {
    const existing = await prisma.agent.findUnique({
      where: { AgentId: nextAgentId },
      select: { id: true },
    })

    if (existing) {
      return badRequest("AgentId is already in use.")
    }
  }

  const updatedAgent = await prisma.agent.update({
    where: { id: agent.id },
    data: {
      ...(nextAgentId !== undefined ? { AgentId: nextAgentId } : {}),
      ...(name !== undefined ? { name } : {}),
      ...(description !== undefined ? { description } : {}),
      ...(position !== undefined ? { position } : {}),
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
      nextAgentId !== undefined && nextAgentId !== agent.AgentId && "AgentId",
      name !== undefined && name !== agent.name && "name",
      description !== undefined &&
        description !== agent.description &&
        "description",
      position !== undefined && position !== agent.position && "position",
    ]),
  })

  return NextResponse.json({ statusCode: 200, agent: updatedAgent })
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const { session, response } = await requireInternalSession()

  if (response) return response

  const { agentId } = await params
  const agent = await prisma.agent.findFirst({
    where: {
      id: agentId,
      company: { userId: session.userId },
    },
  })

  if (!agent) {
    return notFound("Agent not found.")
  }

  await prisma.agent.delete({ where: { id: agent.id } })

  await createAuditLog({
    companyId: agent.companyId,
    action: "agent.deleted",
    target: { type: "agent", id: agent.id, name: agent.name },
    actor: { type: "user", id: session.userId, name: session.username },
    details: `Deleted AgentId ${agent.AgentId}.`,
  })

  return NextResponse.json({ statusCode: 200, agentId: agent.id })
}
