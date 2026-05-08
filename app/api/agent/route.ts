import { NextRequest, NextResponse } from "next/server"

import { agentAuth } from "@/lib/agent-auth"

/**
 * @openapi
 * /api/agent:
 *   get:
 *     summary: Get current agent
 *     responses:
 *       200:
 *         description: Current agent profile
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AgentResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
export async function GET(request: NextRequest) {
  const agent = await agentAuth(request)

  if (!agent) {
    return NextResponse.json({ statusCode: 401, error: "Unauthorized" }, { status: 401 })
  }

  return NextResponse.json({ statusCode: 200, agent })
}
