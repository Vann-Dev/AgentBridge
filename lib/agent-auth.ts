import { createHash } from "node:crypto"

import "server-only"

import { NextRequest } from "next/server"

import { prisma } from "@/lib/prisma"

export async function agentAuth(request: NextRequest) {
  const authorization = request.headers.get("authorization")
  const [scheme, token] = authorization?.split(" ") ?? []

  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return null
  }

  const bearerTokenHash = createHash("sha256").update(token).digest("hex")

  return prisma.agent.findUnique({
    where: { bearerTokenHash },
    select: {
      id: true,
      name: true,
      description: true,
      position: true,
      companyId: true,
      company: {
        select: {
          id: true,
          name: true,
          description: true,
        },
      },
    },
  })
}
