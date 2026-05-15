import { NextResponse } from "next/server"

import { getHealthResponse } from "@/lib/api/health"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export async function GET() {
  const response = await getHealthResponse(() => prisma.$queryRaw`SELECT 1`)

  return NextResponse.json(response, { status: response.statusCode })
}
