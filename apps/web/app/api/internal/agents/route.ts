import { NextRequest, NextResponse } from "next/server"

import { Prisma } from "@/generated/prisma/client"
import { createAuditLog } from "@/lib/api/audit-log"
import {
  cacheJson,
  cacheKey,
  cacheStatusHeader,
  cacheTtl,
  getCompanyCacheVersion,
  invalidateCompanyCache,
} from "@/lib/api/cache"
import { badRequest, requireInternalSession } from "@/lib/api/internal"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  const { session, response } = await requireInternalSession()

  if (response) return response

  const companyId = request.nextUrl.searchParams.get("companyId")

  if (!companyId) {
    return badRequest("Company is required.")
  }

  const company = await prisma.company.findFirst({
    where: { id: companyId, userId: session.userId },
    select: { id: true },
  })

  if (!company) {
    return badRequest("Company not found.")
  }

  const companyVersion = await getCompanyCacheVersion(companyId)
  const { value, cacheStatus } = await cacheJson(
    cacheKey(["internal", "agents", session.userId, companyId, companyVersion]),
    cacheTtl.agentList,
    async () => {
      const agents = await prisma.agent.findMany({
        where: { companyId },
        orderBy: { name: "asc" },
        select: {
          id: true,
          AgentId: true,
          name: true,
          description: true,
          position: true,
          companyId: true,
        },
      })

      return { statusCode: 200, agents }
    }
  )

  return NextResponse.json(value, {
    headers: { "X-AgentBridge-Cache": cacheStatusHeader(cacheStatus) },
  })
}

export async function POST(request: Request) {
  const { session, response } = await requireInternalSession()

  if (response) return response

  const body = (await request.json().catch(() => null)) as {
    companyId?: unknown
    AgentId?: unknown
    name?: unknown
    description?: unknown
    position?: unknown
  } | null

  const companyId = typeof body?.companyId === "string" ? body.companyId : ""
  const AgentId = typeof body?.AgentId === "string" ? body.AgentId.trim() : ""
  const name = typeof body?.name === "string" ? body.name.trim() : ""
  const description = typeof body?.description === "string" ? body.description.trim() : ""
  const position = typeof body?.position === "string" ? body.position.trim() : ""

  if (!companyId || !AgentId || !name || !position) {
    return badRequest("Company, AgentId, name, and position are required.")
  }

  const company = await prisma.company.findFirst({
    where: { id: companyId, userId: session.userId },
  })

  if (!company) {
    return badRequest("Company not found.")
  }

  const existingAgent = await prisma.agent.findUnique({
    where: { AgentId },
    select: { id: true },
  })

  if (existingAgent) {
    return badRequest("AgentId is already in use.")
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
    return badRequest("AgentId is already in use.")
  }

  await createAuditLog({
    companyId,
    action: "agent.created",
    target: { type: "agent", id: agent.id, name: agent.name },
    actor: { type: "user", id: session.userId, name: session.username },
    details: `Created AgentId ${agent.AgentId}.`,
  })
  await invalidateCompanyCache(companyId)

  return NextResponse.json({ statusCode: 201, agent }, { status: 201 })
}
