import { createHash, randomBytes } from "node:crypto"

import { NextResponse } from "next/server"

import { notFound, requireInternalSession } from "@/lib/api/internal"
import { prisma } from "@/lib/prisma"

type RouteContext = {
  params: Promise<{ agentId: string }>
}

export async function POST(_request: Request, { params }: RouteContext) {
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

  const token = `agt_${randomBytes(32).toString("base64url")}`
  const bearerTokenHash = createHash("sha256").update(token).digest("hex")

  await prisma.agent.update({
    where: { id: agent.id },
    data: { bearerTokenHash },
  })

  return NextResponse.json({ statusCode: 200, token })
}
