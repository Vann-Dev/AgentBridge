"use server"

import { revalidatePath } from "next/cache"

import { getSession } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

type CreateProjectResult =
  | { error: string }
  | { error: null }

export async function createProject(
  _state: CreateProjectResult | null,
  formData: FormData
): Promise<CreateProjectResult> {
  const session = await getSession()

  if (!session) {
    return { error: "You must be signed in." }
  }

  const companyId = String(formData.get("companyId") ?? "")
  const name = String(formData.get("name") ?? "").trim()
  const description = String(formData.get("description") ?? "").trim()

  if (!companyId || !name) {
    return { error: "Company and project name are required." }
  }

  const company = await prisma.company.findFirst({
    where: {
      id: companyId,
      userId: session.userId,
    },
  })

  if (!company) {
    return { error: "Company not found." }
  }

  await prisma.project.create({
    data: {
      companyId,
      name,
      description,
    },
  })

  revalidatePath("/dashboard/projects")

  return { error: null }
}
