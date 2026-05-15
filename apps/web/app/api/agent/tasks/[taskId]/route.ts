import { NextRequest, NextResponse } from "next/server"

import { agentAuth } from "@/lib/agent-auth"
import { createAuditLog, formatChangedFields } from "@/lib/api/audit-log"
import { validateAgentTaskPatchInput } from "@/lib/api/agent-task-validation"
import { getTaskFreshnessUpdate } from "@/lib/api/task-freshness"
import { serializeTaskReadMarkers } from "@/lib/api/task-read-markers"
import { agentTaskUpdater } from "@/lib/api/task-updater"
import { prisma } from "@/lib/prisma"


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
 *                 summaryUpdatedAt: "2026-05-11T08:40:00.000Z"
 *                 readBy: []
 *                 blockingReason: null
 *                 taskUpdatedAt: "2026-05-11T08:40:00.000Z"
 *                 taskUpdatedById: "550e8400-e29b-41d4-a716-446655440000"
 *                 taskUpdatedByName: "Build Agent"
 *                 taskUpdatedByType: "agent"
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
      summaryUpdatedAt: true,
      taskUpdatedAt: true,
      taskUpdatedById: true,
      taskUpdatedByName: true,
      taskUpdatedByType: true,
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
      blockedByDependencies: {
        select: {
          dependencyTask: { select: { id: true, name: true, status: true } },
        },
        orderBy: { createdAt: "asc" },
      },
      unblocksDependencies: {
        select: {
          blockedTask: { select: { id: true, name: true, status: true } },
        },
        orderBy: { createdAt: "asc" },
      },
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
 *                 description: Result note or done summary. Trimmed; changed notes refresh summaryUpdatedAt, unchanged notes preserve it, and blank/null clears both note and summaryUpdatedAt.
 *               readBy:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: AgentId values to mark as read for the task's resulting status. Omit when changing status or note unless intentionally marking the result already reviewed.
 *               blockingReason:
 *                 type: string
 *                 nullable: true
 *             minProperties: 1
 *           example:
 *             assignedAgentId: "550e8400-e29b-41d4-a716-446655440000"
 *             name: "Build landing page"
 *             job: "Implement the responsive landing page"
 *             status: "done"
 *             note: "Implemented responsive layout and deployment wiring. Checks: lint pass."
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
 *                 status: "done"
 *                 note: "Implemented responsive layout and deployment wiring. Checks: lint pass."
 *                 summaryUpdatedAt: "2026-05-11T08:40:00.000Z"
 *                 readBy: []
 *                 blockingReason: null
 *                 taskUpdatedAt: "2026-05-11T08:40:00.000Z"
 *                 taskUpdatedById: "550e8400-e29b-41d4-a716-446655440000"
 *                 taskUpdatedByName: "Build Agent"
 *                 taskUpdatedByType: "agent"
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
  const validation = validateAgentTaskPatchInput(updates)

  if (!validation.ok) {
    return NextResponse.json({ statusCode: 400, error: validation.error }, { status: 400 })
  }

  const { data, readBy, hasReadBy } = validation

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
      note: true,
      status: true,
      blockingReason: true,
      projectId: true,
      assignedAgentId: true,
      project: { select: { companyId: true } },
    },
  })

  if (!task) {
    return NextResponse.json({ statusCode: 404, error: "Task not found" }, { status: 404 })
  }

  if (data.assignedAgentId && data.assignedAgentId !== task.assignedAgentId) {
    const projectAgent = await prisma.projectAgent.findFirst({
      where: {
        projectId: task.projectId,
        agentId: data.assignedAgentId,
        project: { companyId: agent.companyId },
      },
      select: { agentId: true },
    })

    if (!projectAgent) {
      return NextResponse.json(
        { statusCode: 400, error: "Agent is not assigned to this project." },
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

  const {
    nextStatus,
    noteChanged,
    shouldClearNextStatusReads,
    summaryUpdatedAt,
  } = getTaskFreshnessUpdate({
    currentStatus: task.status,
    currentNote: task.note,
    nextStatus: data.status,
    nextNote: data.note,
    hasReadBy,
  })
  if (!noteChanged) {
    delete data.note
  } else {
    data.summaryUpdatedAt = summaryUpdatedAt
  }
  const updatedTask = await prisma.$transaction(async (tx: typeof prisma) => {
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
      data: {
        ...data,
        ...agentTaskUpdater(agent),
      },
      select: {
        id: true,
        name: true,
        job: true,
        status: true,
        note: true,
        summaryUpdatedAt: true,
        taskUpdatedAt: true,
        taskUpdatedById: true,
        taskUpdatedByName: true,
        taskUpdatedByType: true,
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
        blockedByDependencies: {
          select: {
            dependencyTask: { select: { id: true, name: true, status: true } },
          },
          orderBy: { createdAt: "asc" },
        },
        unblocksDependencies: {
          select: {
            blockedTask: { select: { id: true, name: true, status: true } },
          },
          orderBy: { createdAt: "asc" },
        },
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

  await createAuditLog({
    companyId: task.project.companyId,
    action: data.status && data.status !== task.status ? "task.status_changed" : "task.updated",
    target: { type: "task", id: task.id, name: updatedTask.name },
    actor: { type: "agent", id: agent.id, name: agent.name },
    details: formatChangedFields([
      data.name && data.name !== task.name && "name",
      data.job && data.job !== task.job && "job",
      data.status && data.status !== task.status && `status (${task.status} → ${data.status})`,
      data.assignedAgentId && data.assignedAgentId !== task.assignedAgentId && "assignee",
      noteChanged && "result note",
      hasReadBy && "read markers",
      data.blockingReason !== undefined &&
        data.blockingReason !== task.blockingReason &&
        "blocking reason",
    ]),
  })

  return NextResponse.json({ statusCode: 200, task: serializeTaskReadMarkers(updatedTask) })
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
    select: { id: true, name: true, project: { select: { companyId: true } } },
  })

  if (!task) {
    return NextResponse.json({ statusCode: 404, error: "Task not found" }, { status: 404 })
  }

  await prisma.task.delete({ where: { id: task.id } })

  await createAuditLog({
    companyId: task.project.companyId,
    action: "task.deleted",
    target: { type: "task", id: task.id, name: task.name },
    actor: { type: "agent", id: agent.id, name: agent.name },
    details: "Task deleted via Agent API.",
  })

  return NextResponse.json({ statusCode: 200, taskId: task.id })
}
