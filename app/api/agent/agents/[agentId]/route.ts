import { NextRequest, NextResponse } from "next/server"

import { agentAuth } from "@/lib/agent-auth"
import { prisma } from "@/lib/prisma"

type RouteContext = {
  params: Promise<{ agentId: string }>
}

type AgentUpdateData = {
  name?: string
  description?: string
  position?: string
}

/**
 * @openapi
 * /api/agent/agents/{agentId}:
 *   get:
 *     tags:
 *       - Agents
 *     summary: Get agent in current company
 *     parameters:
 *       - $ref: '#/components/parameters/PathAgentId'
 *     responses:
 *       200:
 *         description: Agent in current company
 *         content:
 *           application/json:
 *             example:
 *               statusCode: 200
 *               agent:
 *                 id: "550e8400-e29b-41d4-a716-446655440000"
 *                 name: "Build Agent"
 *                 description: "Handles implementation tasks"
 *                 position: "Software Engineer"
 *                 companyId: "7b5f4a6e-0c4a-4bdb-bc73-8b4d7e8a22a1"
 *                 _count:
 *                   tasks: 3
 *             schema:
 *               $ref: '#/components/schemas/CompanyAgentResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
export async function GET(request: NextRequest, { params }: RouteContext) {
  const currentAgent = await agentAuth(request)

  if (!currentAgent) {
    return NextResponse.json({ statusCode: 401, error: "Unauthorized" }, { status: 401 })
  }

  const { agentId } = await params
  const agent = await prisma.agent.findFirst({
    where: {
      id: agentId,
      companyId: currentAgent.companyId,
    },
    select: {
      id: true,
      AgentId: true,
      name: true,
      description: true,
      position: true,
      companyId: true,
      _count: {
        select: { tasks: true },
      },
    },
  })

  if (!agent) {
    return NextResponse.json({ statusCode: 404, error: "Agent not found" }, { status: 404 })
  }

  return NextResponse.json({ statusCode: 200, agent })
}

/**
 * @openapi
 * /api/agent/agents/{agentId}:
 *   patch:
 *     tags:
 *       - Agents
 *     summary: Update agent in current company
 *     parameters:
 *       - $ref: '#/components/parameters/PathAgentId'
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
 *             minProperties: 1
 *           example:
 *             name: "Senior Build Agent"
 *             position: "Senior Software Engineer"
 *     responses:
 *       200:
 *         description: Updated agent
 *         content:
 *           application/json:
 *             example:
 *               statusCode: 200
 *               agent:
 *                 id: "550e8400-e29b-41d4-a716-446655440000"
 *                 name: "Senior Build Agent"
 *                 description: "Handles implementation tasks"
 *                 position: "Senior Software Engineer"
 *                 companyId: "7b5f4a6e-0c4a-4bdb-bc73-8b4d7e8a22a1"
 *             schema:
 *               $ref: '#/components/schemas/AgentResponse'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const currentAgent = await agentAuth(request)

  if (!currentAgent) {
    return NextResponse.json({ statusCode: 401, error: "Unauthorized" }, { status: 401 })
  }

  const body = (await request.json().catch(() => null)) as {
    name?: unknown
    description?: unknown
    position?: unknown
  } | null

  const data: AgentUpdateData = {}

  if (body?.name !== undefined) {
    if (typeof body.name !== "string" || !body.name.trim()) {
      return NextResponse.json(
        { statusCode: 400, error: "Name must be a non-empty string." },
        { status: 400 }
      )
    }

    data.name = body.name.trim()
  }

  if (body?.description !== undefined) {
    if (typeof body.description !== "string") {
      return NextResponse.json(
        { statusCode: 400, error: "Description must be a string." },
        { status: 400 }
      )
    }

    data.description = body.description.trim()
  }

  if (body?.position !== undefined) {
    if (typeof body.position !== "string" || !body.position.trim()) {
      return NextResponse.json(
        { statusCode: 400, error: "Position must be a non-empty string." },
        { status: 400 }
      )
    }

    data.position = body.position.trim()
  }

  if (!Object.keys(data).length) {
    return NextResponse.json(
      { statusCode: 400, error: "No agent updates provided." },
      { status: 400 }
    )
  }

  const { agentId } = await params
  const agent = await prisma.agent.findFirst({
    where: { id: agentId, companyId: currentAgent.companyId },
    select: { id: true },
  })

  if (!agent) {
    return NextResponse.json({ statusCode: 404, error: "Agent not found" }, { status: 404 })
  }

  const updatedAgent = await prisma.agent.update({
    where: { id: agent.id },
    data,
    select: {
      id: true,
      AgentId: true,
      name: true,
      description: true,
      position: true,
      companyId: true,
    },
  })

  return NextResponse.json({ statusCode: 200, agent: updatedAgent })
}

/**
 * @openapi
 * /api/agent/agents/{agentId}:
 *   delete:
 *     tags:
 *       - Agents
 *     summary: Delete agent in current company
 *     parameters:
 *       - $ref: '#/components/parameters/PathAgentId'
 *     responses:
 *       200:
 *         description: Deleted agent id
 *         content:
 *           application/json:
 *             example:
 *               statusCode: 200
 *               agentId: "550e8400-e29b-41d4-a716-446655440000"
 *             schema:
 *               $ref: '#/components/schemas/DeleteAgentResponse'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const currentAgent = await agentAuth(request)

  if (!currentAgent) {
    return NextResponse.json({ statusCode: 401, error: "Unauthorized" }, { status: 401 })
  }

  const { agentId } = await params

  if (agentId === currentAgent.id) {
    return NextResponse.json(
      { statusCode: 400, error: "Current agent cannot delete itself." },
      { status: 400 }
    )
  }

  const agent = await prisma.agent.findFirst({
    where: { id: agentId, companyId: currentAgent.companyId },
    select: {
      id: true,
      _count: {
        select: { tasks: true },
      },
    },
  })

  if (!agent) {
    return NextResponse.json({ statusCode: 404, error: "Agent not found" }, { status: 404 })
  }

  if (agent._count.tasks > 0) {
    return NextResponse.json(
      { statusCode: 400, error: "Agent with assigned tasks cannot be deleted." },
      { status: 400 }
    )
  }

  await prisma.agent.delete({ where: { id: agent.id } })

  return NextResponse.json({ statusCode: 200, agentId: agent.id })
}
