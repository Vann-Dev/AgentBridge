"use server"

import { revalidatePath } from "next/cache"

import { Status } from "@/generated/prisma/enums"
import { invalidateCompanyCache } from "@/lib/api/cache"
import { findReviewReader } from "@/lib/api/review-reader"
import { getSession } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

type MarkNoteReadResult =
  | { ok: true; taskId: string; readBy: string }
  | { ok: false; error: string }

export async function markDoneTaskSummaryReadAction(
  taskId: string
): Promise<MarkNoteReadResult> {
  const session = await getSession()

  if (!session) {
    return { ok: false, error: "Unauthorized" }
  }

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
    return { ok: false, error: "Done task note not found." }
  }

  const reviewReader = await findReviewReader(task.project.companyId)

  if (!reviewReader) {
    return { ok: false, error: "Review reader agent not found." }
  }

  const readAt = new Date()

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
      readAt,
    },
    update: { readAt },
  })

  await invalidateCompanyCache(task.project.companyId)
  revalidatePath("/dashboard/notes")
  revalidatePath(`/dashboard/projects/${task.project.companyId}`)

  return { ok: true, taskId: task.id, readBy: reviewReader.AgentId }
}
