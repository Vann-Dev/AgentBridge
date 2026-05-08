import { NextRequest, NextResponse } from "next/server"

import { Status } from "@/generated/prisma/enums"
import { agentAuth } from "@/lib/agent-auth"
import { prisma } from "@/lib/prisma"

const statuses = Object.values(Status)

/**
 * @openapi
 * /api/agent/tasks:
 *   get:
 *     summary: List current agent tasks
 *     parameters:
 *       - name: status
 *         in: query
 *         required: false
 *         schema:
 *           $ref: '#/components/schemas/Status'
 *     responses:
 *       200:
 *         description: Tasks assigned to current agent
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TasksResponse'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
export async function GET(request: NextRequest) {
  const agent = await agentAuth(request)

  if (!agent) {
    return NextResponse.json({ statusCode: 401, error: "Unauthorized" }, { status: 401 })
  }

  const status = request.nextUrl.searchParams.get("status")

  if (status && !statuses.includes(status as Status)) {
    return NextResponse.json({ statusCode: 400, error: "Invalid task status" }, { status: 400 })
  }

  const tasks = await prisma.task.findMany({
    where: {
      assignedAgentId: agent.id,
      ...(status ? { status: status as Status } : {}),
    },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      job: true,
      status: true,
      blockingReason: true,
      project: {
        select: {
          id: true,
          name: true,
          description: true,
          company: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
  })

  return NextResponse.json({ statusCode: 200, tasks })
}
