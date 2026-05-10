import { NextResponse } from "next/server"

import { Status } from "@/generated/prisma/enums"
import { badRequest, notFound, requireInternalSession } from "@/lib/api/internal"
import { prisma } from "@/lib/prisma"

const statuses = Object.values(Status)

type RouteContext = {
  params: Promise<{ taskId: string }>
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
    blockingReason?: unknown
  } | null
  const assignedAgentId =
    typeof body?.assignedAgentId === "string" ? body.assignedAgentId : undefined
  const name = typeof body?.name === "string" ? body.name.trim() : undefined
  const job = typeof body?.job === "string" ? body.job.trim() : undefined
  const status = typeof body?.status === "string" ? body.status : undefined
  const note = typeof body?.note === "string" ? body.note.trim() : undefined
  const readByAgentIds = parseReadByAgentIds(body?.readByAgentIds)
  const hasReadByAgentIds = body?.readByAgentIds !== undefined
  const blockingReason =
    typeof body?.blockingReason === "string" ? body.blockingReason.trim() : undefined

  if (hasReadByAgentIds && !readByAgentIds) {
    return badRequest("Invalid read markers.")
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
    blockingReason === undefined
  ) {
    return badRequest("No task changes provided.")
  }

  const { taskId } = await params
  const task = await prisma.task.findFirst({
    where: {
      id: taskId,
      project: { company: { userId: session.userId } },
    },
    select: { id: true, note: true, status: true, projectId: true },
  })

  if (!task) {
    return notFound("Task not found.")
  }

  if (assignedAgentId) {
    const agent = await prisma.agent.findFirst({
      where: {
        id: assignedAgentId,
        company: {
          userId: session.userId,
          projects: { some: { id: task.projectId } },
        },
      },
      select: { id: true },
    })

    if (!agent) {
      return badRequest("Assigned agent not found.")
    }
  }

  if (hasReadByAgentIds && readByAgentIds?.length) {
    const readAgents = await prisma.agent.findMany({
      where: {
        id: { in: readByAgentIds },
        company: {
          userId: session.userId,
          projects: { some: { id: task.projectId } },
        },
      },
      select: { id: true },
    })

    if (readAgents.length !== readByAgentIds.length) {
      return badRequest("Read marker agent not found.")
    }
  }

  const nextStatus = (status as Status | undefined) ?? task.status
  const noteChanged = note !== undefined && (note || null) !== task.note
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

    if (noteChanged && !hasReadByAgentIds) {
      await tx.taskReadMarker.deleteMany({ where: { taskId: task.id, status: nextStatus } })
    }

    return tx.task.update({
      where: { id: task.id },
      data: {
        ...(assignedAgentId ? { assignedAgentId } : {}),
        ...(name ? { name } : {}),
        ...(job ? { job } : {}),
        ...(status ? { status: status as Status } : {}),
        ...(note !== undefined ? { note: note || null } : {}),
        ...(blockingReason !== undefined ? { blockingReason: blockingReason || null } : {}),
      },
      include: {
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
      },
    })
  })

  return NextResponse.json({ statusCode: 200, task: updatedTask })
}

function parseReadByAgentIds(value: unknown) {
  if (value === undefined) return []
  if (!Array.isArray(value)) return null

  const agentIds = value.filter((item): item is string => typeof item === "string" && Boolean(item))

  return agentIds.length === value.length ? Array.from(new Set(agentIds)) : null
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const { session, response } = await requireInternalSession()

  if (response) return response

  const { taskId } = await params
  const task = await prisma.task.findFirst({
    where: {
      id: taskId,
      project: { company: { userId: session.userId } },
    },
    select: { id: true },
  })

  if (!task) {
    return notFound("Task not found.")
  }

  await prisma.task.delete({ where: { id: task.id } })

  return NextResponse.json({ statusCode: 200, taskId: task.id })
}
