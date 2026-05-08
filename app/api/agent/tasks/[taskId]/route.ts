import { NextRequest, NextResponse } from "next/server"

import { Status } from "@/generated/prisma/enums"
import { agentAuth } from "@/lib/agent-auth"
import { prisma } from "@/lib/prisma"

const statuses = Object.values(Status)

type RouteContext = {
  params: Promise<{ taskId: string }>
}

/**
 * @openapi
 * /api/agent/tasks/{taskId}:
 *   get:
 *     summary: Get current agent task
 *     parameters:
 *       - $ref: '#/components/parameters/TaskId'
 *     responses:
 *       200:
 *         description: Task assigned to current agent
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TaskResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
export async function GET(request: NextRequest, { params }: RouteContext) {
  const agent = await agentAuth(request)

  if (!agent) {
    return NextResponse.json({ statusCode: 401, error: "Unauthorized" }, { status: 401 })
  }

  const { taskId } = await params
  const task = await prisma.task.findFirst({
    where: {
      id: taskId,
      assignedAgentId: agent.id,
    },
    select: {
      id: true,
      name: true,
      job: true,
      status: true,
      blockingReason: true,
      project: {
        select: {
          id: true,
          name: true,
          description: true,
          company: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
  })

  if (!task) {
    return NextResponse.json({ statusCode: 404, error: "Task not found" }, { status: 404 })
  }

  return NextResponse.json({ statusCode: 200, task })
}

/**
 * @openapi
 * /api/agent/tasks/{taskId}:
 *   patch:
 *     summary: Update current agent task
 *     parameters:
 *       - $ref: '#/components/parameters/TaskId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 $ref: '#/components/schemas/Status'
 *               blockingReason:
 *                 type: string
 *                 nullable: true
 *             minProperties: 1
 *     responses:
 *       200:
 *         description: Updated task
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TaskResponse'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const agent = await agentAuth(request)

  if (!agent) {
    return NextResponse.json({ statusCode: 401, error: "Unauthorized" }, { status: 401 })
  }

  let body: unknown

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ statusCode: 400, error: "Invalid JSON body" }, { status: 400 })
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ statusCode: 400, error: "Invalid JSON body" }, { status: 400 })
  }

  const { taskId } = await params
  const updates = body as { status?: unknown; blockingReason?: unknown }
  const data: { status?: Status; blockingReason?: string | null } = {}

  if (updates.status !== undefined) {
    if (typeof updates.status !== "string" || !statuses.includes(updates.status as Status)) {
      return NextResponse.json({ statusCode: 400, error: "Invalid task status" }, { status: 400 })
    }

    data.status = updates.status as Status
  }

  if (updates.blockingReason !== undefined) {
    if (updates.blockingReason !== null && typeof updates.blockingReason !== "string") {
      return NextResponse.json({ statusCode: 400, error: "Invalid blocking reason" }, { status: 400 })
    }

    data.blockingReason = updates.blockingReason?.trim() || null
  }

  if (!Object.keys(data).length) {
    return NextResponse.json({ statusCode: 400, error: "No task updates provided" }, { status: 400 })
  }

  const task = await prisma.task.findFirst({
    where: {
      id: taskId,
      assignedAgentId: agent.id,
    },
  })

  if (!task) {
    return NextResponse.json({ statusCode: 404, error: "Task not found" }, { status: 404 })
  }

  const updatedTask = await prisma.task.update({
    where: { id: task.id },
    data,
    select: {
      id: true,
      name: true,
      job: true,
      status: true,
      blockingReason: true,
      project: {
        select: {
          id: true,
          name: true,
          description: true,
        },
      },
    },
  })

  return NextResponse.json({ statusCode: 200, task: updatedTask })
}
