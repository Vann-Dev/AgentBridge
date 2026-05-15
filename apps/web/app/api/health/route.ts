import { NextResponse } from "next/server"

import { getHealthResponse } from "@/lib/api/health"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

/**
 * @openapi
 * /api/health:
 *   get:
 *     tags:
 *       - Health
 *     summary: Check service readiness
 *     description: Returns a non-secret app and database readiness response for unauthenticated deployment smoke checks.
 *     security: []
 *     responses:
 *       200:
 *         description: App and database are ready.
 *         content:
 *           application/json:
 *             example:
 *               statusCode: 200
 *               status: healthy
 *               checks:
 *                 app: ok
 *                 database: ok
 *             schema:
 *               $ref: '#/components/schemas/HealthResponse'
 *       503:
 *         description: App can respond, but the database readiness check failed.
 *         content:
 *           application/json:
 *             example:
 *               statusCode: 503
 *               status: degraded
 *               checks:
 *                 app: ok
 *                 database: unavailable
 *             schema:
 *               $ref: '#/components/schemas/HealthResponse'
 */
export async function GET() {
  const response = await getHealthResponse(() => prisma.$queryRaw`SELECT 1`)

  return NextResponse.json(response, { status: response.statusCode })
}
