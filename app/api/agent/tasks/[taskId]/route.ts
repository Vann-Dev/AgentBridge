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
 *     tags:
 *       - Tasks
 *     summary: Get current company task
 *     parameters:
 *       - $ref: '#/components/parameters/TaskId'
 *     responses:
 *       200:
 *         description: Task in current company
 *         content:
 *           application/json:
 *             example:
 *               statusCode: 200
 *               task:
 *                 id: "f4b8b6aa-2d17-46bf-8fa7-7dfc38ad87b8"
 *                 name: "Build landing page"
 *                 job: "Implement the responsive landing page"
 *                 status: "todo"
 *                 blockingReason: null
 *                 project:
 *                   id: "0fdb2bf7-1f5f-4db2-b927-40335a4adcc4"
 *                   name: "Website Redesign"
 *                   description: "Refresh marketing site"
 *                   company:
 *                     id: "7b5f4a6e-0c4a-4bdb-bc73-8b4d7e8a22a1"
 *                     name: "Acme"
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
      project: { companyId: agent.companyId },
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
 *     tags:
 *       - Tasks
 *     summary: Update current company task
 *     parameters:
 *       - $ref: '#/components/parameters/TaskId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               assignedAgentId:
 *                 type: string
 *                 format: uuid
 *               name:
 *                 type: string
 *               job:
 *                 type: string
 *               status:
 *                 $ref: '#/components/schemas/Status'
 *               blockingReason:
 *                 type: string
 *                 nullable: true
 *             minProperties: 1
 *           example:
 *             assignedAgentId: "550e8400-e29b-41d4-a716-446655440000"
 *             name: "Build landing page"
 *             job: "Implement the responsive landing page"
 *             status: "inprogress"
 *             blockingReason: null
 *     responses:
 *       200:
 *         description: Updated task
 *         content:
 *           application/json:
 *             example:
 *               statusCode: 200
 *               task:
 *                 id: "f4b8b6aa-2d17-46bf-8fa7-7dfc38ad87b8"
 *                 name: "Build landing page"
 *                 job: "Implement the responsive landing page"
 *                 status: "inprogress"
 *                 blockingReason: null
 *                 project:
 *                   id: "0fdb2bf7-1f5f-4db2-b927-40335a4adcc4"
 *                   name: "Website Redesign"
 *                   description: "Refresh marketing site"
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
  const updates = body as {
    assignedAgentId?: unknown
    name?: unknown
    job?: unknown
    status?: unknown
    blockingReason?: unknown
  }
  const data: {
    assignedAgentId?: string
    name?: string
    job?: string
    status?: Status
    blockingReason?: string | null
  } = {}

  if (updates.assignedAgentId !== undefined) {
    if (typeof updates.assignedAgentId !== "string" || !updates.assignedAgentId) {
      return NextResponse.json({ statusCode: 400, error: "Invalid assigned agent" }, { status: 400 })
    }

    data.assignedAgentId = updates.assignedAgentId
  }

  if (updates.name !== undefined) {
    if (typeof updates.name !== "string" || !updates.name.trim()) {
      return NextResponse.json(
        { statusCode: 400, error: "Task name is required" },
        { status: 400 }
      )
    }

    data.name = updates.name.trim()
  }

  if (updates.job !== undefined) {
    if (typeof updates.job !== "string" || !updates.job.trim()) {
      return NextResponse.json({ statusCode: 400, error: "Task job is required" }, { status: 400 })
    }

    data.job = updates.job.trim()
  }

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
      project: { companyId: agent.companyId },
    },
    select: { id: true, projectId: true },
  })

  if (!task) {
    return NextResponse.json({ statusCode: 404, error: "Task not found" }, { status: 404 })
  }

  if (data.assignedAgentId) {
    const assignedAgent = await prisma.agent.findFirst({
      where: {
        id: data.assignedAgentId,
        companyId: agent.companyId,
      },
      select: { id: true },
    })

    if (!assignedAgent) {
      return NextResponse.json(
        { statusCode: 400, error: "Assigned agent not found" },
        { status: 400 }
      )
    }
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

/**
 * @openapi
 * /api/agent/tasks/{taskId}:
 *   delete:
 *     tags:
 *       - Tasks
 *     summary: Delete current company task
 *     parameters:
 *       - $ref: '#/components/parameters/TaskId'
 *     responses:
 *       200:
 *         description: Deleted task id
 *         content:
 *           application/json:
 *             example:
 *               statusCode: 200
 *               taskId: "f4b8b6aa-2d17-46bf-8fa7-7dfc38ad87b8"
 *             schema:
 *               $ref: '#/components/schemas/DeleteTaskResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const agent = await agentAuth(request)

  if (!agent) {
    return NextResponse.json({ statusCode: 401, error: "Unauthorized" }, { status: 401 })
  }

  const { taskId } = await params
  const task = await prisma.task.findFirst({
    where: {
      id: taskId,
      project: { companyId: agent.companyId },
    },
    select: { id: true },
  })

  if (!task) {
    return NextResponse.json({ statusCode: 404, error: "Task not found" }, { status: 404 })
  }

  await prisma.task.delete({ where: { id: task.id } })

  return NextResponse.json({ statusCode: 200, taskId: task.id })
}
