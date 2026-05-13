"use server"

import { revalidatePath } from "next/cache"

import { createAuditLog, formatChangedFields } from "@/lib/api/audit-log"
import { invalidateProjectAndCompanyCache } from "@/lib/api/cache"
import { getSession } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

type ProjectRow = {
  id: string
  name: string
  description: string
}

type ProjectResult =
  | { ok: true; project: ProjectRow }
  | { ok: false; error: string }

type DeleteProjectResult =
  | { ok: true; projectId: string }
  | { ok: false; error: string }

export async function createProjectAction(
  formData: FormData
): Promise<ProjectResult> {
  const session = await getSession()

  if (!session) {
    return { ok: false, error: "Unauthorized" }
  }

  const companyId = String(formData.get("companyId") ?? "")
  const name = String(formData.get("name") ?? "").trim()
  const description = String(formData.get("description") ?? "").trim()

  if (!companyId || !name) {
    return { ok: false, error: "Company and project name are required." }
  }

  const company = await prisma.company.findFirst({
    where: { id: companyId, userId: session.userId },
    select: { id: true },
  })

  if (!company) {
    return { ok: false, error: "Company not found." }
  }

  const project = await prisma.project.create({
    data: {
      companyId,
      name,
      description,
    },
    select: projectSelect,
  })

  await createAuditLog({
    companyId,
    action: "project.created",
    target: { type: "project", id: project.id, name: project.name },
    actor: { type: "user", id: session.userId, name: session.username },
    details: description ? "Project created with a description." : "Project created.",
  })
  await invalidateProjectAndCompanyCache({
    companyId,
    projectId: project.id,
  })
  revalidateProjectPaths(project.id)

  return { ok: true, project }
}

export async function renameProjectAction(
  projectId: string,
  formData: FormData
): Promise<ProjectResult> {
  const session = await getSession()

  if (!session) {
    return { ok: false, error: "Unauthorized" }
  }

  const name = String(formData.get("name") ?? "").trim()

  if (!name) {
    return { ok: false, error: "Project name is required." }
  }

  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      company: { userId: session.userId },
    },
    select: { id: true, companyId: true, name: true },
  })

  if (!project) {
    return { ok: false, error: "Project not found." }
  }

  const updatedProject = await prisma.project.update({
    where: { id: project.id },
    data: { name },
    select: projectSelect,
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
  await invalidateProjectAndCompanyCache({
    companyId: project.companyId,
    projectId: project.id,
  })
  revalidateProjectPaths(project.id)

  return { ok: true, project: updatedProject }
}

export async function deleteProjectAction(
  projectId: string
): Promise<DeleteProjectResult> {
  const session = await getSession()

  if (!session) {
    return { ok: false, error: "Unauthorized" }
  }

  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      company: { userId: session.userId },
    },
    select: { id: true, companyId: true, name: true },
  })

  if (!project) {
    return { ok: false, error: "Project not found." }
  }

  await prisma.project.delete({ where: { id: project.id } })

  await createAuditLog({
    companyId: project.companyId,
    action: "project.deleted",
    target: { type: "project", id: project.id, name: project.name },
    actor: { type: "user", id: session.userId, name: session.username },
    details: "Project deleted.",
  })
  await invalidateProjectAndCompanyCache({
    companyId: project.companyId,
    projectId: project.id,
  })
  revalidateProjectPaths(project.id)

  return { ok: true, projectId: project.id }
}

const projectSelect = {
  id: true,
  name: true,
  description: true,
} as const

function revalidateProjectPaths(projectId?: string) {
  revalidatePath("/dashboard")
  revalidatePath("/dashboard/projects")

  if (projectId) {
    revalidatePath(`/dashboard/projects/${projectId}`)
  }
}
