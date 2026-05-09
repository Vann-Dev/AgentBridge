import { createHash, randomBytes } from "node:crypto"

import { NextRequest, NextResponse } from "next/server"

import { agentAuth } from "@/lib/agent-auth"
import { prisma } from "@/lib/prisma"

function generateToken() {
  const token = `agt_${randomBytes(32).toString("base64url")}`
  const bearerTokenHash = createHash("sha256").update(token).digest("hex")

  return { token, bearerTokenHash }
}

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
 *         description: Created agent and one-time bearer token
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
 *               token: "agt_example_token"
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

  const body = (await request.json().catch(() => null)) as {
    name?: unknown
    description?: unknown
    position?: unknown
  } | null

  const name = typeof body?.name === "string" ? body.name.trim() : ""
  const description = typeof body?.description === "string" ? body.description.trim() : ""
  const position = typeof body?.position === "string" ? body.position.trim() : ""

  if (!name || !position) {
    return NextResponse.json(
      { statusCode: 400, error: "Name and position are required." },
      { status: 400 }
    )
  }

  const { token, bearerTokenHash } = generateToken()
  const agent = await prisma.agent.create({
    data: {
      companyId: currentAgent.companyId,
      name,
      description,
      position,
      bearerTokenHash,
    },
    select: {
      id: true,
      name: true,
      description: true,
      position: true,
      companyId: true,
    },
  })

  return NextResponse.json({ statusCode: 201, agent, token }, { status: 201 })
}
