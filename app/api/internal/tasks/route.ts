import { NextResponse } from "next/server"

import { Status } from "@/generated/prisma/enums"
import { badRequest, requireInternalSession } from "@/lib/api/internal"
import { prisma } from "@/lib/prisma"

const statuses = Object.values(Status)

export async function POST(request: Request) {
  const { session, response } = await requireInternalSession()

  if (response) return response

  const body = (await request.json().catch(() => null)) as {
    projectId?: unknown
    assignedAgentId?: unknown
    name?: unknown
    job?: unknown
    status?: unknown
    blockingReason?: unknown
  } | null

  const projectId = typeof body?.projectId === "string" ? body.projectId : ""
  const assignedAgentId = typeof body?.assignedAgentId === "string" ? body.assignedAgentId : ""
  const name = typeof body?.name === "string" ? body.name.trim() : ""
  const job = typeof body?.job === "string" ? body.job.trim() : ""
  const status = typeof body?.status === "string" ? body.status : "todo"
  const blockingReason =
    typeof body?.blockingReason === "string" ? body.blockingReason.trim() : ""

  if (!projectId || !assignedAgentId || !name || !job) {
    return badRequest("Project, agent, name, and job are required.")
  }

  if (!statuses.includes(status as Status)) {
    return badRequest("Invalid task status.")
  }

  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      company: {
        userId: session.userId,
        agents: { some: { id: assignedAgentId } },
      },
    },
  })

  if (!project) {
    return badRequest("Project or agent not found.")
  }

  const task = await prisma.task.create({
    data: {
      projectId,
      assignedAgentId,
      name,
      job,
      status: status as Status,
      blockingReason: blockingReason || null,
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

  return NextResponse.json({ statusCode: 201, task }, { status: 201 })
}
