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
  const body = (await request.json().catch(() => null)) as { status?: unknown } | null
  const status = typeof body?.status === "string" ? body.status : ""

  if (!statuses.includes(status as Status)) {
    return badRequest("Invalid task status.")
  }

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

  const updatedTask = await prisma.task.update({
    where: { id: task.id },
    data: { status: status as Status },
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
