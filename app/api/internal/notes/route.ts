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
    },
  })

  return NextResponse.json({
    statusCode: 200,
    notes: notes.map((task) => ({
      ...task,
      note: task.note ?? "",
      summaryUpdatedAt: task.summaryUpdatedAt?.toISOString() ?? null,
    })),
  })
}
