import { NextRequest, NextResponse } from "next/server"

import { createAuditLog } from "@/lib/api/audit-log"
import {
  cacheJson,
  cacheKey,
  cacheStatusHeader,
  cacheTtl,
  getCompanyCacheVersion,
  invalidateCompanyCache,
} from "@/lib/api/cache"
import { badRequest, requireInternalSession } from "@/lib/api/internal"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  const { session, response } = await requireInternalSession()

  if (response) return response

  const companyId = request.nextUrl.searchParams.get("companyId")

  if (!companyId) {
    return badRequest("Company is required.")
  }

  const company = await prisma.company.findFirst({
    where: { id: companyId, userId: session.userId },
    select: { id: true },
  })

  if (!company) {
    return badRequest("Company not found.")
  }

  const companyVersion = await getCompanyCacheVersion(companyId)
  const { value, cacheStatus } = await cacheJson(
    cacheKey(["internal", "projects", session.userId, companyId, companyVersion]),
    cacheTtl.projectList,
    async () => {
      const projects = await prisma.project.findMany({
        where: { companyId },
        orderBy: { name: "asc" },
      })

      return { statusCode: 200, projects }
    }
  )

  return NextResponse.json(value, {
    headers: { "X-AgentBridge-Cache": cacheStatusHeader(cacheStatus) },
  })
}

export async function POST(request: Request) {
  const { session, response } = await requireInternalSession()

  if (response) return response

  const body = (await request.json().catch(() => null)) as {
    companyId?: unknown
    name?: unknown
    description?: unknown
  } | null

  const companyId = typeof body?.companyId === "string" ? body.companyId : ""
  const name = typeof body?.name === "string" ? body.name.trim() : ""
  const description = typeof body?.description === "string" ? body.description.trim() : ""

  if (!companyId || !name) {
    return badRequest("Company and project name are required.")
  }

  const company = await prisma.company.findFirst({
    where: { id: companyId, userId: session.userId },
  })

  if (!company) {
    return badRequest("Company not found.")
  }

  const project = await prisma.project.create({
    data: {
      companyId,
      name,
      description,
    },
  })

  await createAuditLog({
    companyId,
    action: "project.created",
    target: { type: "project", id: project.id, name: project.name },
    actor: { type: "user", id: session.userId, name: session.username },
    details: description ? "Project created with a description." : "Project created.",
  })
  await invalidateCompanyCache(companyId)

  return NextResponse.json({ statusCode: 201, project }, { status: 201 })
}
