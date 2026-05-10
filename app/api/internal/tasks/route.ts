import { NextResponse } from "next/server"

import { Status } from "@/generated/prisma/enums"
import { createAuditLog } from "@/lib/api/audit-log"
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
    note?: unknown
    readByAgentIds?: unknown
    blockingReason?: unknown
  } | null

  const projectId = typeof body?.projectId === "string" ? body.projectId : ""
  const assignedAgentId = typeof body?.assignedAgentId === "string" ? body.assignedAgentId : ""
  const name = typeof body?.name === "string" ? body.name.trim() : ""
  const job = typeof body?.job === "string" ? body.job.trim() : ""
  const status = typeof body?.status === "string" ? body.status : "todo"
  const note = typeof body?.note === "string" ? body.note.trim() : ""
  const blockingReason =
    typeof body?.blockingReason === "string" ? body.blockingReason.trim() : ""

  if (!projectId || !assignedAgentId || !name || !job) {
    return badRequest("Project, agent, name, and job are required.")
  }

  if (!statuses.includes(status as Status)) {
    return badRequest("Invalid task status.")
  }

  const readByAgentIds = parseReadByAgentIds(body?.readByAgentIds)

  if (!readByAgentIds) {
    return badRequest("Invalid read markers.")
  }

  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      company: {
        userId: session.userId,
        agents: { some: { id: assignedAgentId } },
      },
    },
    select: {
      id: true,
      companyId: true,
      company: {
        select: {
          agents: {
            where: { id: { in: readByAgentIds } },
            select: { id: true },
          },
        },
      },
    },
  })

  if (!project) {
    return badRequest("Project or agent not found.")
  }

  if (project.company.agents.length !== readByAgentIds.length) {
    return badRequest("Read marker agent not found.")
  }

  const task = await prisma.task.create({
    data: {
      projectId,
      assignedAgentId,
      name,
      job,
      status: status as Status,
      note: note || null,
      blockingReason: blockingReason || null,
      readMarkers: {
        create: readByAgentIds.map((agentId) => ({
          agentId,
          status: status as Status,
        })),
      },
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
      },
    },
  })

  await createAuditLog({
    companyId: project.companyId,
    action: "task.created",
    target: { type: "task", id: task.id, name: task.name },
    actor: { type: "user", id: session.userId, name: session.username },
    details: `Created as ${task.status} and assigned to ${task.assigned.name}.`,
  })

  return NextResponse.json({ statusCode: 201, task }, { status: 201 })
}

function parseReadByAgentIds(value: unknown) {
  if (value === undefined) return []
  if (!Array.isArray(value)) return null

  const agentIds = value.filter((item): item is string => typeof item === "string" && Boolean(item))

  return agentIds.length === value.length ? Array.from(new Set(agentIds)) : null
}
