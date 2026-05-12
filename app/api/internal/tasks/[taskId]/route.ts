import { NextResponse } from "next/server"

import { Status } from "@/generated/prisma/enums"
import { createAuditLog, formatChangedFields } from "@/lib/api/audit-log"
import { hasDependencyCycle, serializeTaskDependencies } from "@/lib/api/task-dependencies"
import { badRequest, notFound, requireInternalSession } from "@/lib/api/internal"
import {
  appendServerTiming,
  startServerTiming,
} from "@/lib/api/server-timing"
import { userTaskUpdater } from "@/lib/api/task-updater"
import { prisma } from "@/lib/prisma"

const statuses = Object.values(Status)

type RouteContext = {
  params: Promise<{ taskId: string }>
}

export async function GET(_request: Request, { params }: RouteContext) {
  const totalTiming = startServerTiming("ab-task-detail", "total")
  const { session, response } = await requireInternalSession()

  if (response) return response

  const { taskId } = await params
  const task = await prisma.task.findFirst({
    where: {
      id: taskId,
      project: { company: { userId: session.userId } },
      archivedAt: null,
    },
    select: {
      id: true,
      name: true,
      job: true,
      status: true,
      note: true,
      summaryUpdatedAt: true,
      blockingReason: true,
      archivedAt: true,
      taskUpdatedAt: true,
      taskUpdatedById: true,
      taskUpdatedByName: true,
      taskUpdatedByType: true,
      assigned: {
        select: {
          id: true,
          name: true,
          position: true,
        },
      },
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
      blockedByDependencies: {
        select: {
          dependencyTask: {
            select: {
              id: true,
              name: true,
              status: true,
            },
          },
        },
        orderBy: { createdAt: "asc" },
      },
      unblocksDependencies: {
        select: {
          blockedTask: {
            select: {
              id: true,
              name: true,
              status: true,
            },
          },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  })

  if (!task) {
    return notFound("Task not found.")
  }

  const jsonResponse = NextResponse.json({
    statusCode: 200,
    task: serializeTaskDependencies(task),
  })
  appendServerTiming(jsonResponse.headers, [totalTiming])

  return jsonResponse
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const { session, response } = await requireInternalSession()

  if (response) return response
  const body = (await request.json().catch(() => null)) as {
    assignedAgentId?: unknown
    name?: unknown
    job?: unknown
    status?: unknown
    note?: unknown
    readByAgentIds?: unknown
    dependencyIds?: unknown
    blockingReason?: unknown
  } | null
  const assignedAgentId =
    typeof body?.assignedAgentId === "string" ? body.assignedAgentId : undefined
  const name = typeof body?.name === "string" ? body.name.trim() : undefined
  const job = typeof body?.job === "string" ? body.job.trim() : undefined
  const status = typeof body?.status === "string" ? body.status : undefined
  const note = typeof body?.note === "string" ? body.note.trim() : undefined
  const readByAgentIds = parseStringIds(body?.readByAgentIds)
  const hasReadByAgentIds = body?.readByAgentIds !== undefined
  const dependencyIds = parseStringIds(body?.dependencyIds)
  const hasDependencyIds = body?.dependencyIds !== undefined
  const blockingReason =
    typeof body?.blockingReason === "string" ? body.blockingReason.trim() : undefined

  if (hasReadByAgentIds && !readByAgentIds) {
    return badRequest("Invalid read markers.")
  }

  if (hasDependencyIds && !dependencyIds) {
    return badRequest("Invalid dependency tasks.")
  }

  if (status && !statuses.includes(status as Status)) {
    return badRequest("Invalid task status.")
  }

  if (name === "" || job === "") {
    return badRequest("Task name and job are required.")
  }

  if (
    !assignedAgentId &&
    !name &&
    !job &&
    !status &&
    note === undefined &&
    !hasReadByAgentIds &&
    !hasDependencyIds &&
    blockingReason === undefined
  ) {
    return badRequest("No task changes provided.")
  }

  const { taskId } = await params
  const task = await prisma.task.findFirst({
    where: {
      id: taskId,
      project: { company: { userId: session.userId } },
      archivedAt: null,
    },
    select: {
      id: true,
      name: true,
      job: true,
      note: true,
      status: true,
      blockingReason: true,
      assignedAgentId: true,
      projectId: true,
      project: { select: { companyId: true } },
      assigned: { select: { name: true } },
      blockedByDependencies: { select: { dependencyTaskId: true } },
    },
  })

  if (!task) {
    return notFound("Task not found.")
  }

  if (assignedAgentId && assignedAgentId !== task.assignedAgentId) {
    const projectAgent = await prisma.projectAgent.findFirst({
      where: {
        projectId: task.projectId,
        agentId: assignedAgentId,
        project: { company: { userId: session.userId } },
      },
      select: { agentId: true },
    })

    if (!projectAgent) {
      return badRequest("Agent is not assigned to this project.")
    }
  }

  if (hasDependencyIds && dependencyIds?.includes(task.id)) {
    return badRequest("Task cannot depend on itself.")
  }

  if (hasDependencyIds && dependencyIds?.length) {
    const dependencyTasks = await prisma.task.findMany({
      where: {
        id: { in: dependencyIds },
        projectId: task.projectId,
        archivedAt: null,
        project: { company: { userId: session.userId } },
      },
      select: { id: true },
    })

    if (dependencyTasks.length !== dependencyIds.length) {
      return badRequest("Dependency task not found.")
    }

    const projectDependencies = await prisma.taskDependency.findMany({
      where: { blockedTask: { projectId: task.projectId, archivedAt: null } },
      select: { blockedTaskId: true, dependencyTaskId: true },
    })

    if (hasDependencyCycle(projectDependencies, task.id, dependencyIds)) {
      return badRequest("Task dependencies cannot create a cycle.")
    }
  }

  if (hasReadByAgentIds && readByAgentIds?.length) {
    const readAgents = await prisma.agent.findMany({
      where: {
        id: { in: readByAgentIds },
        company: { userId: session.userId },
      },
      select: { id: true },
    })

    if (readAgents.length !== readByAgentIds.length) {
      return badRequest("Read marker agent not found.")
    }
  }

  const nextStatus = (status as Status | undefined) ?? task.status
  const statusChanged = nextStatus !== task.status
  const noteChanged = note !== undefined && (note || null) !== task.note
  const shouldClearNextStatusReads = !hasReadByAgentIds && (statusChanged || noteChanged)
  const updatedTask = await prisma.$transaction(async (tx) => {
    if (hasReadByAgentIds) {
      await tx.taskReadMarker.deleteMany({
        where: {
          taskId: task.id,
          status: nextStatus,
          agentId: { notIn: readByAgentIds ?? [] },
        },
      })

      if (readByAgentIds?.length) {
        await Promise.all(
          readByAgentIds.map((agentId) =>
            tx.taskReadMarker.upsert({
              where: {
                taskId_agentId_status: {
                  taskId: task.id,
                  agentId,
                  status: nextStatus,
                },
              },
              create: {
                taskId: task.id,
                agentId,
                status: nextStatus,
              },
              update: { readAt: new Date() },
            })
          )
        )
      }
    }

    if (shouldClearNextStatusReads) {
      await tx.taskReadMarker.deleteMany({ where: { taskId: task.id, status: nextStatus } })
    }

    if (hasDependencyIds) {
      await tx.taskDependency.deleteMany({ where: { blockedTaskId: task.id } })

      if (dependencyIds?.length) {
        await tx.taskDependency.createMany({
          data: dependencyIds.map((dependencyTaskId) => ({
            blockedTaskId: task.id,
            dependencyTaskId,
          })),
        })
      }
    }

    return tx.task.update({
      where: { id: task.id },
      data: {
        ...(assignedAgentId ? { assignedAgentId } : {}),
        ...(name ? { name } : {}),
        ...(job ? { job } : {}),
        ...(status ? { status: status as Status } : {}),
        ...(noteChanged
          ? { note: note || null, summaryUpdatedAt: note ? new Date() : null }
          : {}),
        ...(blockingReason !== undefined ? { blockingReason: blockingReason || null } : {}),
        ...userTaskUpdater({ id: session.userId, name: session.username }),
      },
      select: {
        id: true,
        name: true,
        job: true,
        status: true,
        note: true,
        summaryUpdatedAt: true,
        blockingReason: true,
        archivedAt: true,
        taskUpdatedAt: true,
        taskUpdatedById: true,
        taskUpdatedByName: true,
        taskUpdatedByType: true,
        assigned: {
          select: {
            id: true,
            name: true,
            position: true,
          },
        },
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
        blockedByDependencies: {
          select: {
            dependencyTask: {
              select: {
                id: true,
                name: true,
                status: true,
              },
            },
          },
          orderBy: { createdAt: "asc" },
        },
        unblocksDependencies: {
          select: {
            blockedTask: {
              select: {
                id: true,
                name: true,
                status: true,
              },
            },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    })
  })

  await createAuditLog({
    companyId: task.project.companyId,
    action: status && status !== task.status ? "task.status_changed" : "task.updated",
    target: { type: "task", id: task.id, name: updatedTask.name },
    actor: { type: "user", id: session.userId, name: session.username },
    details: formatChangedFields([
      name && name !== task.name && "name",
      job && job !== task.job && "job",
      status && status !== task.status && `status (${task.status} → ${status})`,
      assignedAgentId && assignedAgentId !== task.assignedAgentId && "assignee",
      noteChanged && "result note",
      hasReadByAgentIds && "read markers",
      hasDependencyIds && "dependencies",
      blockingReason !== undefined &&
        (blockingReason || null) !== task.blockingReason &&
        "blocking reason",
    ]),
  })

  return NextResponse.json({ statusCode: 200, task: serializeTaskDependencies(updatedTask) })
}

function parseStringIds(value: unknown) {
  if (value === undefined) return []
  if (!Array.isArray(value)) return null

  const ids = value.filter((item): item is string => typeof item === "string" && Boolean(item))

  return ids.length === value.length ? Array.from(new Set(ids)) : null
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const { session, response } = await requireInternalSession()

  if (response) return response

  const { taskId } = await params
  const task = await prisma.task.findFirst({
    where: {
      id: taskId,
      project: { company: { userId: session.userId } },
      archivedAt: null,
    },
    select: { id: true, name: true, project: { select: { companyId: true } } },
  })

  if (!task) {
    return notFound("Task not found.")
  }

  await prisma.task.delete({ where: { id: task.id } })

  await createAuditLog({
    companyId: task.project.companyId,
    action: "task.deleted",
    target: { type: "task", id: task.id, name: task.name },
    actor: { type: "user", id: session.userId, name: session.username },
    details: "Task deleted.",
  })

  return NextResponse.json({ statusCode: 200, taskId: task.id })
}
