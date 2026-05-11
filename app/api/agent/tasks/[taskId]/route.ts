import { NextRequest, NextResponse } from "next/server"

import { Status } from "@/generated/prisma/enums"
import { agentAuth } from "@/lib/agent-auth"
import { serializeTaskReadMarkers } from "@/lib/api/task-read-markers"
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
 *                 note: "Completed responsive layout and deployment wiring."
 *                 readBy: []
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
      archivedAt: null,
    },
    select: {
      id: true,
      name: true,
      job: true,
      status: true,
      note: true,
      readMarkers: {
        select: {
          agentId: true,
          status: true,
          readAt: true,
          agent: {
            select: {
              id: true,
              AgentId: true,
              name: true,
            },
          },
        },
        orderBy: { readAt: "desc" },
      },
      blockingReason: true,
      archivedAt: true,
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

  return NextResponse.json({ statusCode: 200, task: serializeTaskReadMarkers(task) })
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
 *               note:
 *                 type: string
 *                 nullable: true
 *               readBy:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: AgentId values to mark as read for the task's resulting status.
 *               blockingReason:
 *                 type: string
 *                 nullable: true
 *             minProperties: 1
 *           example:
 *             assignedAgentId: "550e8400-e29b-41d4-a716-446655440000"
 *             name: "Build landing page"
 *             job: "Implement the responsive landing page"
 *             status: "inprogress"
 *             note: "Completed responsive layout and deployment wiring."
 *             readBy: []
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
 *                 note: "Completed responsive layout and deployment wiring."
 *                 readBy: []
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
    note?: unknown
    readBy?: unknown
    blockingReason?: unknown
  }
  const data: {
    assignedAgentId?: string
    name?: string
    job?: string
    status?: Status
    note?: string | null
    blockingReason?: string | null
  } = {}
  const readBy = parseReadByAgentIds(updates.readBy)
  const hasReadBy = updates.readBy !== undefined

  if (hasReadBy && !readBy) {
    return NextResponse.json({ statusCode: 400, error: "Invalid read markers" }, { status: 400 })
  }

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

  if (updates.note !== undefined) {
    if (updates.note !== null && typeof updates.note !== "string") {
      return NextResponse.json({ statusCode: 400, error: "Invalid task note" }, { status: 400 })
    }

    data.note = updates.note?.trim() || null
  }

  if (updates.blockingReason !== undefined) {
    if (updates.blockingReason !== null && typeof updates.blockingReason !== "string") {
      return NextResponse.json({ statusCode: 400, error: "Invalid blocking reason" }, { status: 400 })
    }

    data.blockingReason = updates.blockingReason?.trim() || null
  }

  if (!Object.keys(data).length && !hasReadBy) {
    return NextResponse.json({ statusCode: 400, error: "No task updates provided" }, { status: 400 })
  }

  const task = await prisma.task.findFirst({
    where: {
      id: taskId,
      project: { companyId: agent.companyId },
      archivedAt: null,
    },
    select: { id: true, note: true, status: true, projectId: true },
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

  const readAgents = hasReadBy
    ? await prisma.agent.findMany({
        where: { AgentId: { in: readBy ?? [] }, companyId: agent.companyId },
        select: { id: true, AgentId: true },
      })
    : []

  if (hasReadBy && readAgents.length !== readBy?.length) {
    return NextResponse.json({ statusCode: 400, error: "Read marker agent not found" }, { status: 400 })
  }

  const nextStatus = data.status ?? task.status
  const statusChanged = nextStatus !== task.status
  const noteChanged = data.note !== undefined && data.note !== task.note
  const shouldClearNextStatusReads = !hasReadBy && (statusChanged || noteChanged)
  const updatedTask = await prisma.$transaction(async (tx) => {
    if (hasReadBy) {
      await tx.taskReadMarker.deleteMany({
        where: {
          taskId: task.id,
          status: nextStatus,
          agentId: { notIn: readAgents.map((readAgent) => readAgent.id) },
        },
      })

      await Promise.all(
        readAgents.map((readAgent) =>
          tx.taskReadMarker.upsert({
            where: {
              taskId_agentId_status: {
                taskId: task.id,
                agentId: readAgent.id,
                status: nextStatus,
              },
            },
            create: {
              taskId: task.id,
              agentId: readAgent.id,
              status: nextStatus,
            },
            update: { readAt: new Date() },
          })
        )
      )
    }

    if (shouldClearNextStatusReads) {
      await tx.taskReadMarker.deleteMany({ where: { taskId: task.id, status: nextStatus } })
    }

    return tx.task.update({
      where: { id: task.id },
      data,
      select: {
        id: true,
        name: true,
        job: true,
        status: true,
        note: true,
        readMarkers: {
          select: {
            agentId: true,
            status: true,
            readAt: true,
            agent: {
              select: {
                id: true,
                AgentId: true,
                name: true,
              },
            },
          },
          orderBy: { readAt: "desc" },
        },
        blockingReason: true,
        archivedAt: true,
        project: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
      },
    })
  })

  return NextResponse.json({ statusCode: 200, task: serializeTaskReadMarkers(updatedTask) })
}

function parseReadByAgentIds(value: unknown) {
  if (value === undefined) return []
  if (!Array.isArray(value)) return null

  const agentIds = value.filter((item): item is string => typeof item === "string" && Boolean(item))

  return agentIds.length === value.length ? Array.from(new Set(agentIds)) : null
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
      archivedAt: null,
    },
    select: { id: true },
  })

  if (!task) {
    return NextResponse.json({ statusCode: 404, error: "Task not found" }, { status: 404 })
  }

  await prisma.task.delete({ where: { id: task.id } })

  return NextResponse.json({ statusCode: 200, taskId: task.id })
}
