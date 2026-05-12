import { NextResponse } from "next/server"

import { createAuditLog, formatChangedFields } from "@/lib/api/audit-log"
import { projectAgentSelect, serializeProjectAgents } from "@/lib/api/project-agents"
import { serializeTaskDependencies } from "@/lib/api/task-dependencies"
import { badRequest, notFound, requireInternalSession } from "@/lib/api/internal"
import { prisma } from "@/lib/prisma"

type RouteContext = {
  params: Promise<{ projectId: string }>
}

export async function GET(_request: Request, { params }: RouteContext) {
  const { session, response: authResponse } = await requireInternalSession()

  if (authResponse) return authResponse

  const startedAt = Date.now()
  const { projectId } = await params
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

  if (!project) {
    return notFound("Project not found.")
  }

  const tasks = await prisma.task.findMany({
    where: { projectId: project.id, archivedAt: null },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
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

  const [readMarkers, dependencyEdges] = taskIds.length
    ? await Promise.all([
        prisma.taskReadMarker.findMany({
          where: { taskId: { in: taskIds } },
          orderBy: { readAt: "desc" },
          select: {
            taskId: true,
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
    : [[], []]

  const readMarkersByTask = new Map<string, typeof readMarkers>()
  for (const readMarker of readMarkers) {
    const taskReadMarkers = readMarkersByTask.get(readMarker.taskId) ?? []
    taskReadMarkers.push(readMarker)
    readMarkersByTask.set(readMarker.taskId, taskReadMarkers)
  }

  const dependenciesByTask = new Map<string, Array<{ dependencyTask: { id: string; name: string; status: typeof tasks[number]["status"] } }>>()
  const unblocksByTask = new Map<string, Array<{ blockedTask: { id: string; name: string; status: typeof tasks[number]["status"] } }>>()
  for (const edge of dependencyEdges) {
    if (edge.blockedTask.archivedAt || edge.dependencyTask.archivedAt) continue

    const blockedByDependencies = dependenciesByTask.get(edge.blockedTaskId) ?? []
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
      tasks: tasks.map((task) =>
        serializeTaskDependencies({
          ...task,
          readMarkers: readMarkersByTask.get(task.id) ?? [],
          blockedByDependencies: dependenciesByTask.get(task.id) ?? [],
          unblocksDependencies: unblocksByTask.get(task.id) ?? [],
        })
      ),
    },
  })
  jsonResponse.headers.set("Server-Timing", `project-detail;dur=${Date.now() - startedAt}`)

  return jsonResponse
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const { session, response } = await requireInternalSession()

  if (response) return response

  const body = (await request.json().catch(() => null)) as { name?: unknown } | null
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
    details: formatChangedFields([project.name !== updatedProject.name && "name"]),
  })

  return NextResponse.json({ statusCode: 200, project: updatedProject })
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
