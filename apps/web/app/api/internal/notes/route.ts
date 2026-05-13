import { NextRequest, NextResponse } from "next/server"

import {
  cacheJson,
  cacheKey,
  cacheStatusHeader,
  cacheTtl,
  getCompanyCacheVersion,
} from "@/lib/api/cache"
import { badRequest, requireInternalSession } from "@/lib/api/internal"
import { findReviewReader } from "@/lib/api/review-reader"
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

  const companyVersion = await getCompanyCacheVersion(company.id)
  const { value, cacheStatus } = await cacheJson(
    cacheKey(["internal", "notes", session.userId, company.id, companyVersion]),
    cacheTtl.notes,
    async () => {
      const reviewReader = await findReviewReader(company.id)

      if (!reviewReader) {
        return {
          statusCode: 200,
          notes: [],
          reviewReader: null,
        }
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
          taskUpdatedAt: true,
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
              agentId: reviewReader.id,
            },
            select: { readAt: true },
          },
        },
      })
      const unreadNotes = notes.filter((task) => {
        const readAt = task.readMarkers[0]?.readAt

        const summaryUpdatedAt = task.summaryUpdatedAt ?? task.taskUpdatedAt

        return !readAt || readAt < summaryUpdatedAt
      })

      return {
        statusCode: 200,
        reviewReader,
        notes: unreadNotes.map((task) => ({
          id: task.id,
          name: task.name,
          status: task.status,
          note: task.note ?? "",
          summaryUpdatedAt: (task.summaryUpdatedAt ?? task.taskUpdatedAt).toISOString(),
          assigned: task.assigned,
          project: task.project,
        })),
      }
    }
  )

  return NextResponse.json(value, {
    headers: { "X-AgentBridge-Cache": cacheStatusHeader(cacheStatus) },
  })
}
