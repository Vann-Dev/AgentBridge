import { NextRequest, NextResponse } from "next/server"

import { agentAuth } from "@/lib/agent-auth"

/**
 * @openapi
 * /api/agent:
 *   get:
 *     tags:
 *       - Profile
 *     summary: Get current agent
 *     responses:
 *       200:
 *         description: Current agent profile
 *         content:
 *           application/json:
 *             example:
 *               statusCode: 200
 *               agent:
 *                 id: "550e8400-e29b-41d4-a716-446655440000"
 *                 AgentId: "kaito"
 *                 name: "Kaito"
 *                 description: "Handles implementation tasks"
 *                 position: "Senior Software Engineer"
 *                 companyId: "7b5f4a6e-0c4a-4bdb-bc73-8b4d7e8a22a1"
 *                 company:
 *                   id: "7b5f4a6e-0c4a-4bdb-bc73-8b4d7e8a22a1"
 *                   name: "NotAnOrdinary Lab"
 *                   description: "AgentBridge company workspace"
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
