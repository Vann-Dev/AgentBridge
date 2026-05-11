import { NextResponse } from "next/server"

import { Status } from "@/generated/prisma/enums"
import { notFound, requireInternalSession } from "@/lib/api/internal"
import { findReviewReader } from "@/lib/api/review-reader"
import { prisma } from "@/lib/prisma"

type RouteContext = {
  params: Promise<{ taskId: string }>
}

export async function POST(_request: Request, { params }: RouteContext) {
  const { session, response } = await requireInternalSession()

  if (response) return response

  const { taskId } = await params
  const task = await prisma.task.findFirst({
    where: {
      id: taskId,
      status: Status.done,
      archivedAt: null,
      note: { not: null },
      project: { company: { userId: session.userId } },
    },
    select: {
      id: true,
      project: { select: { companyId: true } },
    },
  })

  if (!task) {
    return notFound("Done task note not found.")
  }

  const reviewReader = await findReviewReader(task.project.companyId)

  if (!reviewReader) {
    return notFound("Review reader agent not found.")
  }

  await prisma.taskReadMarker.upsert({
    where: {
      taskId_agentId_status: {
        taskId: task.id,
        agentId: reviewReader.id,
        status: Status.done,
      },
    },
    create: {
      taskId: task.id,
      agentId: reviewReader.id,
      status: Status.done,
    },
    update: { readAt: new Date() },
  })

  return NextResponse.json({
    statusCode: 200,
    taskId: task.id,
    readBy: reviewReader.AgentId,
  })
}
