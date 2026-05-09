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
    blockingReason?: unknown
  } | null
  const assignedAgentId =
    typeof body?.assignedAgentId === "string" ? body.assignedAgentId : undefined
  const name = typeof body?.name === "string" ? body.name.trim() : undefined
  const job = typeof body?.job === "string" ? body.job.trim() : undefined
  const status = typeof body?.status === "string" ? body.status : undefined
  const blockingReason =
    typeof body?.blockingReason === "string" ? body.blockingReason.trim() : undefined

  if (status && !statuses.includes(status as Status)) {
    return badRequest("Invalid task status.")
  }

  if (name === "" || job === "") {
    return badRequest("Task name and job are required.")
  }

  if (!assignedAgentId && !name && !job && !status && blockingReason === undefined) {
    return badRequest("No task changes provided.")
  }

  const { taskId } = await params
  const task = await prisma.task.findFirst({
    where: {
      id: taskId,
      project: { company: { userId: session.userId } },
    },
    select: { id: true, projectId: true },
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

  const updatedTask = await prisma.task.update({
    where: { id: task.id },
    data: {
      ...(assignedAgentId ? { assignedAgentId } : {}),
      ...(name ? { name } : {}),
      ...(job ? { job } : {}),
      ...(status ? { status: status as Status } : {}),
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
    },
  })

  return NextResponse.json({ statusCode: 200, task: updatedTask })
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
