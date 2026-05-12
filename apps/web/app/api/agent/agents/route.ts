import { NextRequest, NextResponse } from "next/server"

import { Prisma } from "@/generated/prisma/client"
import { agentAuth } from "@/lib/agent-auth"
import { prisma } from "@/lib/prisma"

/**
 * @openapi
 * /api/agent/agents:
 *   get:
 *     tags:
 *       - Agents
 *     summary: List agents in current company
 *     responses:
 *       200:
 *         description: Agents in current company
 *         content:
 *           application/json:
 *             example:
 *               statusCode: 200
 *               agents:
 *                 - id: "550e8400-e29b-41d4-a716-446655440000"
 *                   AgentId: "kaito"
 *                   name: "Build Agent"
 *                   description: "Handles implementation tasks"
 *                   position: "Software Engineer"
 *                   _count:
 *                     tasks: 3
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
      AgentId: true,
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

/**
 * @openapi
 * /api/agent/agents:
 *   post:
 *     tags:
 *       - Agents
   *     summary: Create agent in current company
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               AgentId:
 *                 type: string
 *                 description: Stable API identifier the new agent uses in the AgentId header.
 *                 example: review-agent-01
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               position:
 *                 type: string
 *             required: [AgentId, name, position]
 *           example:
 *             AgentId: "review-agent-01"
 *             name: "Review Agent"
 *             description: "Reviews completed implementation tasks"
 *             position: "Code Reviewer"
 *     responses:
 *       201:
   *         description: Created agent
 *         content:
 *           application/json:
 *             example:
 *               statusCode: 201
 *               agent:
 *                 id: "a27d7a32-97aa-43df-a9cb-5a41e3fb7b6c"
 *                 AgentId: "review-agent-01"
 *                 name: "Review Agent"
 *                 description: "Reviews completed implementation tasks"
 *                 position: "Code Reviewer"
 *                 companyId: "7b5f4a6e-0c4a-4bdb-bc73-8b4d7e8a22a1"
 *             schema:
 *               $ref: '#/components/schemas/AgentCreatedResponse'
 *       400:
 *         description: Invalid request or duplicate AgentId
 *         content:
 *           application/json:
 *             examples:
 *               missingFields:
 *                 value:
 *                   statusCode: 400
 *                   error: "AgentId, name, and position are required."
 *               duplicateAgentId:
 *                 value:
 *                   statusCode: 400
 *                   error: "AgentId is already in use."
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
export async function POST(request: NextRequest) {
  const currentAgent = await agentAuth(request)

  if (!currentAgent) {
    return NextResponse.json({ statusCode: 401, error: "Unauthorized" }, { status: 401 })
  }

  const { companyId } = currentAgent

  const body = (await request.json().catch(() => null)) as {
    AgentId?: unknown
    name?: unknown
    description?: unknown
    position?: unknown
  } | null

  const AgentId = typeof body?.AgentId === "string" ? body.AgentId.trim() : ""
  const name = typeof body?.name === "string" ? body.name.trim() : ""
  const description = typeof body?.description === "string" ? body.description.trim() : ""
  const position = typeof body?.position === "string" ? body.position.trim() : ""

  if (!AgentId || !name || !position) {
    return NextResponse.json(
      { statusCode: 400, error: "AgentId, name, and position are required." },
      { status: 400 }
    )
  }

  const existingAgent = await prisma.agent.findUnique({
    where: { AgentId },
    select: { id: true },
  })

  if (existingAgent) {
    return NextResponse.json(
      { statusCode: 400, error: "AgentId is already in use." },
      { status: 400 }
    )
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
    return NextResponse.json(
      { statusCode: 400, error: "AgentId is already in use." },
      { status: 400 }
    )
  }

  return NextResponse.json({ statusCode: 201, agent }, { status: 201 })
}
