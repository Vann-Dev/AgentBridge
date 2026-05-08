import { NextRequest, NextResponse } from "next/server"

import { agentAuth } from "@/lib/agent-auth"
import { prisma } from "@/lib/prisma"

/**
 * @openapi
 * /api/agent/agents:
 *   get:
 *     summary: List agents in current company
 *     responses:
 *       200:
 *         description: Agents in current company
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AgentsResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
export async function GET(request: NextRequest) {
  const agent = await agentAuth(request)

  if (!agent) {
    return NextResponse.json({ statusCode: 401, error: "Unauthorized" }, { status: 401 })
  }

  const agents = await prisma.agent.findMany({
    where: { companyId: agent.companyId },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      description: true,
      position: true,
      _count: {
        select: { tasks: true },
      },
    },
  })

  return NextResponse.json({ statusCode: 200, agents })
}
