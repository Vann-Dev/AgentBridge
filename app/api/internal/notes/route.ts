import { NextRequest, NextResponse } from "next/server"

import { badRequest, requireInternalSession } from "@/lib/api/internal"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  const { session, response } = await requireInternalSession()

  if (response) return response

  const companyId = request.nextUrl.searchParams.get("company")

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

  const notes = await prisma.task.findMany({
    where: {
      archivedAt: null,
      note: { not: null },
      status: "done",
      project: { companyId: company.id },
    },
    orderBy: [{ summaryUpdatedAt: "desc" }, { name: "asc" }],
    take: 100,
    select: {
      id: true,
      name: true,
      status: true,
      note: true,
      summaryUpdatedAt: true,
      assigned: {
        select: {
          id: true,
          name: true,
          position: true,
        },
      },
      project: {
        select: {
          id: true,
          name: true,
        },
      },
      readMarkers: {
        where: {
          status: "done",
          agent: { AgentId: "main" },
        },
        select: { readAt: true },
      },
    },
  })
  const unreadNotes = notes.filter((task) => {
    const readAt = task.readMarkers[0]?.readAt

    return !readAt || !task.summaryUpdatedAt || readAt < task.summaryUpdatedAt
  })

  return NextResponse.json({
    statusCode: 200,
    notes: unreadNotes.map((task) => ({
      id: task.id,
      name: task.name,
      status: task.status,
      note: task.note ?? "",
      summaryUpdatedAt: task.summaryUpdatedAt?.toISOString() ?? null,
      assigned: task.assigned,
      project: task.project,
    })),
  })
}
