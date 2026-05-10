import { NextRequest, NextResponse } from "next/server"

import { badRequest, requireInternalSession } from "@/lib/api/internal"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  const { session, response } = await requireInternalSession()

  if (response) return response

  const companyId = request.nextUrl.searchParams.get("companyId")

  if (!companyId) {
    return badRequest("Company is required.")
  }

  const agents = await prisma.agent.findMany({
    where: {
      companyId,
      company: { userId: session.userId },
    },
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

  return NextResponse.json({ statusCode: 200, agents })
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

  const agent = await prisma.agent.create({
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

  return NextResponse.json({ statusCode: 201, agent }, { status: 201 })
}
