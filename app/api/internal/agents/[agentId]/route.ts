import { NextResponse } from "next/server"

import { notFound, requireInternalSession } from "@/lib/api/internal"
import { prisma } from "@/lib/prisma"

type RouteContext = {
  params: Promise<{ agentId: string }>
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

  return NextResponse.json({ statusCode: 200, agentId: agent.id })
}
