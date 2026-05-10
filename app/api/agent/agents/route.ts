import { NextRequest, NextResponse } from "next/server"

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
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               position:
 *                 type: string
 *             required: [name, position]
 *           example:
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
 *                 name: "Review Agent"
 *                 description: "Reviews completed implementation tasks"
 *                 position: "Code Reviewer"
 *                 companyId: "7b5f4a6e-0c4a-4bdb-bc73-8b4d7e8a22a1"
 *             schema:
 *               $ref: '#/components/schemas/AgentCreatedResponse'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
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
