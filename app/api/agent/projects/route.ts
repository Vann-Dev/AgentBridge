import { NextRequest, NextResponse } from "next/server"

import { agentAuth } from "@/lib/agent-auth"
import { prisma } from "@/lib/prisma"

/**
 * @openapi
 * /api/agent/projects:
 *   get:
 *     summary: List projects in current company
 *     responses:
 *       200:
 *         description: Projects in current company
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ProjectsResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
export async function GET(request: NextRequest) {
  const agent = await agentAuth(request)

  if (!agent) {
    return NextResponse.json({ statusCode: 401, error: "Unauthorized" }, { status: 401 })
  }

  const projects = await prisma.project.findMany({
    where: {
      companyId: agent.companyId,
    },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      description: true,
      tasks: {
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          job: true,
          status: true,
          blockingReason: true,
          assigned: {
            select: {
              id: true,
              name: true,
              position: true,
            },
          },
        },
      },
    },
  })

  return NextResponse.json({ statusCode: 200, projects })
}
