import { NextRequest, NextResponse } from "next/server"

import {
  cacheJson,
  cacheKey,
  cacheStatusHeader,
  cacheTtl,
  getCompanyCacheVersion,
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
    cacheKey([
      "internal",
      "dashboard-summary",
      session.userId,
      companyId,
      companyVersion,
    ]),
    cacheTtl.dashboardSummary,
    async () => {
      const [agents, projects, tasks] = await Promise.all([
        prisma.agent.count({ where: { companyId } }),
        prisma.project.count({ where: { companyId } }),
        prisma.task.groupBy({
          by: ["status"],
          where: { project: { companyId } },
          _count: { _all: true },
        }),
      ])

      const taskCounts = Object.fromEntries(
        tasks.map((task) => [task.status, task._count._all])
      )

      return {
        statusCode: 200,
        summary: {
          agents,
          projects,
          tasks: taskCounts,
        },
      }
    }
  )

  return NextResponse.json(value, {
    headers: { "X-AgentBridge-Cache": cacheStatusHeader(cacheStatus) },
  })
}
