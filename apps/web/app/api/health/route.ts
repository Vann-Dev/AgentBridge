import { NextResponse } from "next/server"

import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

type HealthResponse = {
  statusCode: 200 | 503
  status: "healthy" | "degraded"
  checks: {
    app: "ok"
    database: "ok" | "unavailable"
  }
}

export async function GET() {
  const response: HealthResponse = {
    statusCode: 200,
    status: "healthy",
    checks: {
      app: "ok",
      database: "ok",
    },
  }

  try {
    await prisma.$queryRaw`SELECT 1`
  } catch {
    response.statusCode = 503
    response.status = "degraded"
    response.checks.database = "unavailable"
  }

  return NextResponse.json(response, { status: response.statusCode })
}
