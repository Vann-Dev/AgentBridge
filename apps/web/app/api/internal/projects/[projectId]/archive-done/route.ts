import { NextResponse } from "next/server"

import { Status } from "@/generated/prisma/enums"
import { createAuditLog } from "@/lib/api/audit-log"
import { notFound, requireInternalSession } from "@/lib/api/internal"
import { prisma } from "@/lib/prisma"

type RouteContext = {
  params: Promise<{ projectId: string }>
}

export async function POST(_request: Request, { params }: RouteContext) {
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

  const archivedAt = new Date()
  const result = await prisma.task.updateMany({
    where: {
      projectId: project.id,
      status: Status.done,
      archivedAt: null,
    },
    data: { archivedAt },
  })

  await createAuditLog({
    companyId: project.companyId,
    action: "project.tasks.archived",
    target: { type: "project", id: project.id, name: project.name },
    actor: { type: "user", id: session.userId, name: session.username },
    details: `Archived ${result.count} done task${result.count === 1 ? "" : "s"}.`,
  })

  return NextResponse.json({
    statusCode: 200,
    archivedCount: result.count,
    archivedAt: archivedAt.toISOString(),
  })
}
