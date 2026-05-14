"use server"

import { revalidatePath } from "next/cache"

import { Status } from "@/generated/prisma/enums"
import { createAuditLog, formatChangedFields } from "@/lib/api/audit-log"
import { invalidateProjectAndCompanyCache } from "@/lib/api/cache"
import {
  projectAgentSelect,
  serializeProjectAgents,
} from "@/lib/api/project-agents"
import {
  hasDependencyCycle,
  serializeTaskDependencies,
} from "@/lib/api/task-dependencies"
import { getTaskFreshnessUpdate } from "@/lib/api/task-freshness"
import { userTaskUpdater } from "@/lib/api/task-updater"
import { getSession } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

import type { ProjectDetailData, ProjectTaskDetail } from "./types"

const statuses = Object.values(Status)

type ActionResult<T> = ({ ok: true } & T) | { ok: false; error: string }

type TaskMutationPayload = {
  assignedAgentId: string
  name: string
  job: string
  status: string
  note: string
  readByAgentIds: string[]
  blockingReason: string
  dependencyIds?: string[]
}

type CreateTaskPayload = TaskMutationPayload & {
  projectId: string
}

export async function getProjectDetailAction(
  projectId: string
): Promise<ActionResult<{ project: ProjectDetailData }>> {
  const session = await getSession()

  if (!session) {
    return { ok: false, error: "Unauthorized" }
  }

  const project = (await loadProjectDetail(projectId, session.userId)) as ProjectDetailData | null

  if (!project) {
    return { ok: false, error: "Project not found." }
  }

  return { ok: true, project }
}

export async function getTaskDetailAction(
  taskId: string
): Promise<ActionResult<{ task: ProjectTaskDetail }>> {
  const session = await getSession()

  if (!session) {
    return { ok: false, error: "Unauthorized" }
  }

  const task = await loadTaskDetail(taskId, session.userId)

  if (!task) {
    return { ok: false, error: "Task not found." }
  }

  return { ok: true, task }
}

export async function updateProjectAgentsAction(
  projectId: string,
  agentIds: string[]
): Promise<ActionResult<{ agentIds: string[] }>> {
  const session = await getSession()

  if (!session) {
    return { ok: false, error: "Unauthorized" }
  }

  const project = await prisma.project.findFirst({
    where: { id: projectId, company: { userId: session.userId } },
    select: {
      id: true,
      name: true,
      companyId: true,
      agents: { select: { agentId: true } },
      company: {
        select: {
          agents: {
            where: { id: { in: agentIds } },
            select: { id: true },
          },
        },
      },
    },
  })

  if (!project) {
    return { ok: false, error: "Project not found." }
  }

  const uniqueAgentIds = Array.from(new Set(agentIds.filter(Boolean)))

  if (project.company.agents.length !== uniqueAgentIds.length) {
    return { ok: false, error: "Agent not found." }
  }

  await prisma.$transaction(async (tx: typeof prisma) => {
    await tx.projectAgent.deleteMany({ where: { projectId: project.id } })

    if (uniqueAgentIds.length) {
      await tx.projectAgent.createMany({
        data: uniqueAgentIds.map((agentId) => ({
          projectId: project.id,
          agentId,
        })),
      })
    }
  })

  await createAuditLog({
    companyId: project.companyId,
    action: "project.agents_updated",
    target: { type: "project", id: project.id, name: project.name },
    actor: { type: "user", id: session.userId, name: session.username },
    details: `Project agents changed from ${project.agents.length} to ${uniqueAgentIds.length}.`,
  })
  await invalidateAndRevalidate(project.companyId, project.id)

  return { ok: true, agentIds: uniqueAgentIds }
}

export async function createTaskAction(
  payload: CreateTaskPayload
): Promise<ActionResult<{ task: ProjectTaskDetail }>> {
  const session = await getSession()

  if (!session) {
    return { ok: false, error: "Unauthorized" }
  }

  const projectId = payload.projectId
  const assignedAgentId = payload.assignedAgentId
  const name = payload.name.trim()
  const job = payload.job.trim()
  const status = payload.status || "todo"
  const note = payload.note.trim()
  const blockingReason = payload.blockingReason.trim()
  const readByAgentIds = uniqueStrings(payload.readByAgentIds)
  const dependencyIds = uniqueStrings(payload.dependencyIds ?? [])

  if (!projectId || !assignedAgentId || !name || !job) {
    return { ok: false, error: "Project, agent, name, and job are required." }
  }

  if (!statuses.includes(status as Status)) {
    return { ok: false, error: "Invalid task status." }
  }

  const project = await prisma.project.findFirst({
    where: { id: projectId, company: { userId: session.userId } },
    select: {
      id: true,
      companyId: true,
      tasks: {
        where: { id: { in: dependencyIds }, archivedAt: null },
        select: { id: true },
      },
      company: {
        select: {
          agents: {
            where: { id: { in: readByAgentIds } },
            select: { id: true },
          },
        },
      },
      agents: {
        where: { agentId: assignedAgentId },
        select: { agentId: true },
      },
    },
  })

  if (!project) {
    return { ok: false, error: "Project or agent not found." }
  }

  if (!project.agents.length) {
    return { ok: false, error: "Agent is not assigned to this project." }
  }

  if (project.company.agents.length !== readByAgentIds.length) {
    return { ok: false, error: "Read marker agent not found." }
  }

  if (project.tasks.length !== dependencyIds.length) {
    return { ok: false, error: "Dependency task not found." }
  }

  const task = await prisma.task.create({
    data: {
      projectId,
      assignedAgentId,
      name,
      job,
      status: status as Status,
      note: note || null,
      summaryUpdatedAt: note ? new Date() : null,
      blockingReason: blockingReason || null,
      ...userTaskUpdater({ id: session.userId, name: session.username }),
      readMarkers: {
        create: readByAgentIds.map((agentId) => ({
          agentId,
          status: status as Status,
        })),
      },
      blockedByDependencies: {
        create: dependencyIds.map((dependencyTaskId) => ({ dependencyTaskId })),
      },
    },
    include: taskDetailInclude,
  })

  await createAuditLog({
    companyId: project.companyId,
    action: "task.created",
    target: { type: "task", id: task.id, name: task.name },
    actor: { type: "user", id: session.userId, name: session.username },
    details: `Created as ${task.status} and assigned to ${task.assigned.name}${dependencyIds.length ? ` with ${dependencyIds.length} dependencies` : ""}.`,
  })
  await invalidateAndRevalidate(project.companyId, project.id)

  return { ok: true, task: serializeTaskDependencies(task) as unknown as ProjectTaskDetail }
}

export async function updateTaskStatusAction(
  taskId: string,
  status: Status
): Promise<ActionResult<{ task: ProjectTaskDetail }>> {
  return updateTaskAction(taskId, { status } as TaskMutationPayload)
}

export async function updateTaskAction(
  taskId: string,
  payload: Partial<TaskMutationPayload>
): Promise<ActionResult<{ task: ProjectTaskDetail }>> {
  const session = await getSession()

  if (!session) {
    return { ok: false, error: "Unauthorized" }
  }

  const assignedAgentId = payload.assignedAgentId
  const name = payload.name?.trim()
  const job = payload.job?.trim()
  const status = payload.status
  const note = payload.note?.trim()
  const hasNote = payload.note !== undefined
  const hasReadByAgentIds = payload.readByAgentIds !== undefined
  const readByAgentIds = uniqueStrings(payload.readByAgentIds ?? [])
  const hasDependencyIds = payload.dependencyIds !== undefined
  const dependencyIds = uniqueStrings(payload.dependencyIds ?? [])
  const blockingReason = payload.blockingReason?.trim()

  if (status && !statuses.includes(status as Status)) {
    return { ok: false, error: "Invalid task status." }
  }

  if (name === "" || job === "") {
    return { ok: false, error: "Task name and job are required." }
  }

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
    },
  })

  if (!task) {
    return { ok: false, error: "Task not found." }
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
      return { ok: false, error: "Agent is not assigned to this project." }
    }
  }

  if (hasDependencyIds && dependencyIds.includes(task.id)) {
    return { ok: false, error: "Task cannot depend on itself." }
  }

  if (hasDependencyIds && dependencyIds.length) {
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
      return { ok: false, error: "Dependency task not found." }
    }

    const projectDependencies = await prisma.taskDependency.findMany({
      where: { blockedTask: { projectId: task.projectId, archivedAt: null } },
      select: { blockedTaskId: true, dependencyTaskId: true },
    })

    if (hasDependencyCycle(projectDependencies, task.id, dependencyIds)) {
      return { ok: false, error: "Task dependencies cannot create a cycle." }
    }
  }

  if (hasReadByAgentIds && readByAgentIds.length) {
    const readAgents = await prisma.agent.findMany({
      where: { id: { in: readByAgentIds }, company: { userId: session.userId } },
      select: { id: true },
    })

    if (readAgents.length !== readByAgentIds.length) {
      return { ok: false, error: "Read marker agent not found." }
    }
  }

  const {
    nextStatus,
    noteChanged,
    shouldClearNextStatusReads,
    summaryUpdatedAt,
  } = getTaskFreshnessUpdate({
    currentStatus: task.status,
    currentNote: task.note,
    nextStatus: status as Status | undefined,
    nextNote: hasNote ? note || null : undefined,
    hasReadBy: hasReadByAgentIds,
  })

  const updatedTask = await prisma.$transaction(async (tx: typeof prisma) => {
    if (hasReadByAgentIds) {
      await tx.taskReadMarker.deleteMany({
        where: {
          taskId: task.id,
          status: nextStatus,
          agentId: { notIn: readByAgentIds },
        },
      })

      if (readByAgentIds.length) {
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
              create: { taskId: task.id, agentId, status: nextStatus },
              update: { readAt: new Date() },
            })
          )
        )
      }
    }

    if (shouldClearNextStatusReads) {
      await tx.taskReadMarker.deleteMany({
        where: { taskId: task.id, status: nextStatus },
      })
    }

    if (hasDependencyIds) {
      await tx.taskDependency.deleteMany({ where: { blockedTaskId: task.id } })

      if (dependencyIds.length) {
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
        ...(noteChanged ? { note: note || null, summaryUpdatedAt } : {}),
        ...(blockingReason !== undefined
          ? { blockingReason: blockingReason || null }
          : {}),
        ...userTaskUpdater({ id: session.userId, name: session.username }),
      },
      include: taskDetailInclude,
    })
  })

  await createAuditLog({
    companyId: task.project.companyId,
    action:
      status && status !== task.status ? "task.status_changed" : "task.updated",
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
  await invalidateAndRevalidate(task.project.companyId, task.projectId)

  return {
    ok: true,
    task: serializeTaskDependencies(updatedTask) as unknown as ProjectTaskDetail,
  }
}

export async function archiveDoneTasksAction(
  projectId: string
): Promise<ActionResult<{ archivedCount: number }>> {
  const session = await getSession()

  if (!session) {
    return { ok: false, error: "Unauthorized" }
  }

  const project = await prisma.project.findFirst({
    where: { id: projectId, company: { userId: session.userId } },
    select: { id: true, name: true, companyId: true },
  })

  if (!project) {
    return { ok: false, error: "Project not found." }
  }

  const result = await prisma.task.updateMany({
    where: { projectId: project.id, status: Status.done, archivedAt: null },
    data: { archivedAt: new Date() },
  })

  await createAuditLog({
    companyId: project.companyId,
    action: "project.tasks.archived",
    target: { type: "project", id: project.id, name: project.name },
    actor: { type: "user", id: session.userId, name: session.username },
    details: `Archived ${result.count} done task${result.count === 1 ? "" : "s"}.`,
  })
  await invalidateAndRevalidate(project.companyId, project.id)

  return { ok: true, archivedCount: result.count }
}

export async function deleteTaskAction(
  taskId: string
): Promise<ActionResult<{ taskId: string }>> {
  const session = await getSession()

  if (!session) {
    return { ok: false, error: "Unauthorized" }
  }

  const task = await prisma.task.findFirst({
    where: {
      id: taskId,
      project: { company: { userId: session.userId } },
      archivedAt: null,
    },
    select: {
      id: true,
      name: true,
      projectId: true,
      project: { select: { companyId: true } },
    },
  })

  if (!task) {
    return { ok: false, error: "Task not found." }
  }

  await prisma.task.delete({ where: { id: task.id } })

  await createAuditLog({
    companyId: task.project.companyId,
    action: "task.deleted",
    target: { type: "task", id: task.id, name: task.name },
    actor: { type: "user", id: session.userId, name: session.username },
    details: "Task deleted.",
  })
  await invalidateAndRevalidate(task.project.companyId, task.projectId)

  return { ok: true, taskId: task.id }
}

async function loadProjectDetail(projectId: string, userId: string) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, company: { userId } },
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

  if (!project) return null

  const tasks = await loadProjectTaskCards(project.id)

  return {
    ...project,
    projectAgents: serializeProjectAgents(project.agents),
    agents: undefined,
    tasks,
  }
}

export async function loadProjectTaskCards(projectId: string) {
  const tasks = await prisma.task.findMany({
    where: { projectId, archivedAt: null },
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
      readMarkers: {
        where: { status: Status.done, agent: { AgentId: "main" } },
        select: { readAt: true },
      },
      assigned: { select: { id: true, name: true, position: true } },
    },
  })
  const taskIds = tasks.map((task) => task.id)
  const [readCounts, dependencyEdges] = taskIds.length
    ? await Promise.all([
        prisma.taskReadMarker.groupBy({
          by: ["taskId", "status"],
          where: { taskId: { in: taskIds } },
          _count: { _all: true },
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
              select: { id: true, name: true, status: true, archivedAt: true },
            },
            dependencyTask: {
              select: { id: true, name: true, status: true, archivedAt: true },
            },
          },
        }),
      ])
    : [[], []]

  const readCountByTaskStatus = new Map<string, number>()
  for (const readCount of readCounts) {
    readCountByTaskStatus.set(
      `${readCount.taskId}:${readCount.status}`,
      readCount._count._all
    )
  }

  const dependenciesByTask = new Map<string, Array<{ dependencyTask: TaskDependencyRow }>>()
  const unblocksByTask = new Map<string, Array<{ blockedTask: TaskDependencyRow }>>()

  for (const edge of dependencyEdges) {
    if (edge.blockedTask.archivedAt || edge.dependencyTask.archivedAt) {
      continue
    }

    const blockedByDependencies = dependenciesByTask.get(edge.blockedTaskId) ?? []
    blockedByDependencies.push({ dependencyTask: edge.dependencyTask })
    dependenciesByTask.set(edge.blockedTaskId, blockedByDependencies)

    const unblocksDependencies = unblocksByTask.get(edge.dependencyTaskId) ?? []
    unblocksDependencies.push({ blockedTask: edge.blockedTask })
    unblocksByTask.set(edge.dependencyTaskId, unblocksDependencies)
  }

  return tasks.map((task) => {
    const { note, readMarkers, ...taskCard } = task
    const dependencies =
      dependenciesByTask.get(task.id)?.map((dependency) => dependency.dependencyTask) ?? []
    const unblocks =
      unblocksByTask.get(task.id)?.map((dependency) => dependency.blockedTask) ?? []
    const doneReviewReadAt = readMarkers[0]?.readAt
    const notePreview = compactText(note)
    const summaryUpdatedAt = getTaskSummaryUpdatedAt({
      note,
      summaryUpdatedAt: task.summaryUpdatedAt,
      taskUpdatedAt: task.taskUpdatedAt,
    })

    return {
      ...taskCard,
      notePreview,
      summaryUpdatedAt,
      blockingReason: null,
      readCount: readCountByTaskStatus.get(`${task.id}:${task.status}`) ?? 0,
      blockingReasonPreview: compactText(task.blockingReason),
      dependencies: dependencies.slice(0, 3),
      dependencyIds: dependencies.map((dependency) => dependency.id),
      dependencyCount: dependencies.length,
      unblocks: unblocks.slice(0, 3),
      unblocksCount: unblocks.length,
      isDependencyReady:
        dependencies.length > 0 &&
        dependencies.every((dependency) => dependency.status === Status.done),
      isUnreadDoneSummary:
        task.status === Status.done &&
        Boolean(summaryUpdatedAt) &&
        (!doneReviewReadAt ||
          new Date(doneReviewReadAt) < new Date(summaryUpdatedAt ?? 0)),
    }
  })
}

async function loadTaskDetail(taskId: string, userId: string) {
  const task = await prisma.task.findFirst({
    where: {
      id: taskId,
      project: { company: { userId } },
      archivedAt: null,
    },
    include: taskDetailInclude,
  })

  return task ? (serializeTaskDependencies(task) as unknown as ProjectTaskDetail) : null
}

const taskDetailInclude = {
  assigned: { select: { id: true, name: true, position: true } },
  readMarkers: {
    select: {
      agentId: true,
      status: true,
      readAt: true,
      agent: { select: { id: true, AgentId: true, name: true } },
    },
    orderBy: { readAt: "desc" },
  },
  blockedByDependencies: {
    select: {
      dependencyTask: { select: { id: true, name: true, status: true } },
    },
    orderBy: { createdAt: "asc" },
  },
  unblocksDependencies: {
    select: {
      blockedTask: { select: { id: true, name: true, status: true } },
    },
    orderBy: { createdAt: "asc" },
  },
} as const

type TaskDependencyRow = {
  id: string
  name: string
  status: Status
}

function compactText(value: string | null) {
  if (!value) return null

  const compacted = value.replace(/\s+/g, " ").trim()

  return compacted.length > 180 ? `${compacted.slice(0, 177)}...` : compacted
}

function getTaskSummaryUpdatedAt({
  note,
  summaryUpdatedAt,
  taskUpdatedAt,
}: {
  note: string | null
  summaryUpdatedAt: Date | null
  taskUpdatedAt: Date
}) {
  if (!note) return null

  return summaryUpdatedAt ?? taskUpdatedAt
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)))
}

async function invalidateAndRevalidate(companyId: string, projectId: string) {
  await invalidateProjectAndCompanyCache({ companyId, projectId })
  revalidatePath("/dashboard")
  revalidatePath("/dashboard/projects")
  revalidatePath(`/dashboard/projects/${projectId}`)
}
