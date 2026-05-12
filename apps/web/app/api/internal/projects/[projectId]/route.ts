import { NextResponse } from "next/server"

import { Status } from "@/generated/prisma/enums"
import { createAuditLog, formatChangedFields } from "@/lib/api/audit-log"
import {
  projectAgentSelect,
  serializeProjectAgents,
} from "@/lib/api/project-agents"
import {
  badRequest,
  notFound,
  requireInternalSession,
} from "@/lib/api/internal"
import {
  appendServerTiming,
  formatServerTimingMetric,
  startServerTiming,
} from "@/lib/api/server-timing"
import { prisma } from "@/lib/prisma"

type RouteContext = {
  params: Promise<{ projectId: string }>
}

export async function GET(_request: Request, { params }: RouteContext) {
  const totalTiming = startServerTiming("ab-project-detail", "total")
  const { session, response: authResponse } = await requireInternalSession()

  if (authResponse) return authResponse

  const { projectId } = await params
  const projectQueryTiming = startServerTiming("ab-project-shell", "project shell")
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      company: { userId: session.userId },
    },
    select: {
      id: true,
      companyId: true,
      name: true,
      description: true,
      company: {
        select: {
          id: true,
          name: true,
          agents: {
            orderBy: { name: "asc" },
            select: {
              id: true,
              AgentId: true,
              name: true,
              position: true,
            },
          },
        },
      },
      agents: {
        orderBy: { agent: { name: "asc" } },
        select: projectAgentSelect,
      },
    },
  })

  const projectTiming = formatServerTimingMetric(projectQueryTiming)

  if (!project) {
    return notFound("Project not found.")
  }

  const tasksTiming = startServerTiming("ab-project-tasks", "task cards")
  const tasks = await prisma.task.findMany({
    where: { projectId: project.id, archivedAt: null },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      note: true,
      summaryUpdatedAt: true,
      taskUpdatedAt: true,
      taskUpdatedById: true,
      taskUpdatedByName: true,
      taskUpdatedByType: true,
      status: true,
      blockingReason: true,
      assigned: {
        select: {
          id: true,
          name: true,
          position: true,
        },
      },
    },
  })
  const taskIds = tasks.map((task) => task.id)
  const tasksHeaderTiming = formatServerTimingMetric(tasksTiming)

  const metadataTiming = startServerTiming("ab-project-task-meta", "read/dependency meta")
  const [readCounts, doneReviewReads, dependencyEdges] = taskIds.length
    ? await Promise.all([
        prisma.taskReadMarker.groupBy({
          by: ["taskId", "status"],
          where: { taskId: { in: taskIds } },
          _count: { _all: true },
        }),
        prisma.taskReadMarker.findMany({
          where: {
            taskId: { in: taskIds },
            status: Status.done,
            agent: { AgentId: "main" },
          },
          select: { taskId: true, readAt: true },
        }),
        prisma.taskDependency.findMany({
          where: {
            OR: [
              { blockedTaskId: { in: taskIds } },
              { dependencyTaskId: { in: taskIds } },
            ],
          },
          orderBy: { createdAt: "asc" },
          select: {
            blockedTaskId: true,
            dependencyTaskId: true,
            blockedTask: {
              select: {
                id: true,
                name: true,
                status: true,
                archivedAt: true,
              },
            },
            dependencyTask: {
              select: {
                id: true,
                name: true,
                status: true,
                archivedAt: true,
              },
            },
          },
        }),
      ])
    : [[], [], []]
  const metadataHeaderTiming = formatServerTimingMetric(metadataTiming)

  const readCountByTaskStatus = new Map<string, number>()
  for (const readCount of readCounts) {
    readCountByTaskStatus.set(
      `${readCount.taskId}:${readCount.status}`,
      readCount._count._all
    )
  }

  const doneReviewReadByTask = new Map(
    doneReviewReads.map((read) => [read.taskId, read.readAt])
  )

  const dependenciesByTask = new Map<
    string,
    Array<{
      dependencyTask: {
        id: string
        name: string
        status: (typeof tasks)[number]["status"]
      }
    }>
  >()
  const unblocksByTask = new Map<
    string,
    Array<{
      blockedTask: {
        id: string
        name: string
        status: (typeof tasks)[number]["status"]
      }
    }>
  >()
  for (const edge of dependencyEdges) {
    if (edge.blockedTask.archivedAt || edge.dependencyTask.archivedAt) continue

    const blockedByDependencies =
      dependenciesByTask.get(edge.blockedTaskId) ?? []
    blockedByDependencies.push({ dependencyTask: edge.dependencyTask })
    dependenciesByTask.set(edge.blockedTaskId, blockedByDependencies)

    const unblocksDependencies = unblocksByTask.get(edge.dependencyTaskId) ?? []
    unblocksDependencies.push({ blockedTask: edge.blockedTask })
    unblocksByTask.set(edge.dependencyTaskId, unblocksDependencies)
  }

  const jsonResponse = NextResponse.json({
    statusCode: 200,
    project: {
      ...project,
      projectAgents: serializeProjectAgents(project.agents),
      agents: undefined,
      tasks: tasks.map((task) => {
        const { note, ...taskCard } = task
        const dependencies =
          dependenciesByTask
            .get(task.id)
            ?.map((dependency) => dependency.dependencyTask) ?? []
        const unblocks =
          unblocksByTask
            .get(task.id)
            ?.map((dependency) => dependency.blockedTask) ?? []
        const doneReviewReadAt = doneReviewReadByTask.get(task.id)

        const summaryUpdatedAt = task.summaryUpdatedAt ?? (note ? task.taskUpdatedAt : null)

        return {
          ...taskCard,
          summaryUpdatedAt,
          blockingReason: null,
          readCount:
            readCountByTaskStatus.get(`${task.id}:${task.status}`) ?? 0,
          blockingReasonPreview: compactText(task.blockingReason),
          dependencies: dependencies.slice(0, 3),
          dependencyIds: dependencies.map((dependency) => dependency.id),
          dependencyCount: dependencies.length,
          unblocks: unblocks.slice(0, 3),
          unblocksCount: unblocks.length,
          isDependencyReady:
            dependencies.length > 0 &&
            dependencies.every(
              (dependency) => dependency.status === Status.done
            ),
          isUnreadDoneSummary:
            task.status === Status.done &&
            Boolean(summaryUpdatedAt) &&
            (!doneReviewReadAt ||
              new Date(doneReviewReadAt) < new Date(summaryUpdatedAt ?? 0)),
        }
      }),
    },
  })
  appendServerTiming(jsonResponse.headers, [
    projectTiming,
    tasksHeaderTiming,
    metadataHeaderTiming,
    totalTiming,
  ])

  return jsonResponse
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const { session, response } = await requireInternalSession()

  if (response) return response

  const body = (await request.json().catch(() => null)) as {
    name?: unknown
  } | null
  const name = typeof body?.name === "string" ? body.name.trim() : ""

  if (!name) {
    return badRequest("Project name is required.")
  }

  const { projectId } = await params
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      company: { userId: session.userId },
    },
    select: { id: true, companyId: true, name: true },
  })

  if (!project) {
    return notFound("Project not found.")
  }

  const updatedProject = await prisma.project.update({
    where: { id: project.id },
    data: { name },
  })

  await createAuditLog({
    companyId: project.companyId,
    action: "project.updated",
    target: { type: "project", id: project.id, name: updatedProject.name },
    actor: { type: "user", id: session.userId, name: session.username },
    details: formatChangedFields([
      project.name !== updatedProject.name && "name",
    ]),
  })

  return NextResponse.json({ statusCode: 200, project: updatedProject })
}

function compactText(text: string | null) {
  if (!text) return null

  const compact = text.replace(/\s+/g, " ").trim()

  return compact.length > 180 ? `${compact.slice(0, 177)}...` : compact
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const { session, response } = await requireInternalSession()

  if (response) return response

  const { projectId } = await params
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      company: { userId: session.userId },
    },
    select: { id: true, companyId: true, name: true },
  })

  if (!project) {
    return notFound("Project not found.")
  }

  await prisma.project.delete({ where: { id: project.id } })

  await createAuditLog({
    companyId: project.companyId,
    action: "project.deleted",
    target: { type: "project", id: project.id, name: project.name },
    actor: { type: "user", id: session.userId, name: session.username },
    details: "Project deleted.",
  })

  return NextResponse.json({ statusCode: 200, projectId: project.id })
}
