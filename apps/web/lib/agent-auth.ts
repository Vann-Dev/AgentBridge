import { createHash } from "node:crypto"

import "server-only"

import { NextRequest } from "next/server"

import { prisma } from "@/lib/prisma"

export async function agentAuth(request: NextRequest) {
  const authorization = request.headers.get("authorization")
  const AgentId = request.headers.get("AgentId")
  const [scheme, token] = authorization?.split(" ") ?? []

  if (scheme?.toLowerCase() !== "bearer" || !token || !AgentId) {
    return null
  }

  const bearerTokenHash = createHash("sha256").update(token).digest("hex")

  const agent = await prisma.agent.findUnique({
    where: { AgentId },
    select: {
      id: true,
      AgentId: true,
      name: true,
      description: true,
      position: true,
      companyId: true,
      company: {
        select: {
          id: true,
          name: true,
          description: true,
          bearerTokenHash: true,
        },
      },
    },
  })

  if (!agent || agent.company.bearerTokenHash !== bearerTokenHash) {
    return null
  }

  const company = {
    id: agent.company.id,
    name: agent.company.name,
    description: agent.company.description,
  }

  return {
    ...agent,
    company,
  }
}
