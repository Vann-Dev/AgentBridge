"use server"

import { revalidatePath } from "next/cache"

import { Status } from "@/generated/prisma/enums"
import { getSession } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

type CreateTaskResult =
  | { error: string }
  | { error: null }

type UpdateTaskStatusResult =
  | { error: string }
  | { error: null }

const statuses = Object.values(Status)

export async function createTask(
  _state: CreateTaskResult | null,
  formData: FormData
): Promise<CreateTaskResult> {
  const session = await getSession()

  if (!session) {
    return { error: "You must be signed in." }
  }

  const projectId = String(formData.get("projectId") ?? "")
  const assignedAgentId = String(formData.get("assignedAgentId") ?? "")
  const name = String(formData.get("name") ?? "").trim()
  const job = String(formData.get("job") ?? "").trim()
  const status = String(formData.get("status") ?? "todo")
  const blockingReason = String(formData.get("blockingReason") ?? "").trim()

  if (!projectId || !assignedAgentId || !name || !job) {
    return { error: "Project, agent, name, and job are required." }
  }

  if (!statuses.includes(status as Status)) {
    return { error: "Invalid task status." }
  }

  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      company: {
        userId: session.userId,
        agents: {
          some: {
            id: assignedAgentId,
          },
        },
      },
    },
  })

  if (!project) {
    return { error: "Project or agent not found." }
  }

  await prisma.task.create({
    data: {
      projectId,
      assignedAgentId,
      name,
      job,
      status: status as Status,
      blockingReason: blockingReason || null,
    },
  })

  revalidatePath(`/dashboard/projects/${projectId}`)

  return { error: null }
}

export async function updateTaskStatus(
  taskId: string,
  status: Status
): Promise<UpdateTaskStatusResult> {
  const session = await getSession()

  if (!session) {
    return { error: "You must be signed in." }
  }

  if (!statuses.includes(status)) {
    return { error: "Invalid task status." }
  }

  const task = await prisma.task.findFirst({
    where: {
      id: taskId,
      project: {
        company: {
          userId: session.userId,
        },
      },
    },
    select: {
      id: true,
      projectId: true,
    },
  })

  if (!task) {
    return { error: "Task not found." }
  }

  await prisma.task.update({
    where: { id: task.id },
    data: { status },
  })

  revalidatePath(`/dashboard/projects/${task.projectId}`)

  return { error: null }
}
