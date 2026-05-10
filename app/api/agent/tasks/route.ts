import { NextRequest, NextResponse } from "next/server"

import { Status } from "@/generated/prisma/enums"
import { agentAuth } from "@/lib/agent-auth"
import { serializeTaskReadMarkers } from "@/lib/api/task-read-markers"
import { prisma } from "@/lib/prisma"

const statuses = Object.values(Status)

/**
 * @openapi
 * /api/agent/tasks:
 *   get:
 *     tags:
 *       - Tasks
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
 *             example:
 *               statusCode: 200
 *               tasks:
 *                 - id: "f4b8b6aa-2d17-46bf-8fa7-7dfc38ad87b8"
 *                   name: "Build landing page"
 *                   job: "Implement the responsive landing page"
 *                   status: "todo"
 *                   note: null
 *                   readBy: []
 *                   blockingReason: null
 *                   archivedAt: null
 *                   project:
 *                     id: "0fdb2bf7-1f5f-4db2-b927-40335a4adcc4"
 *                     name: "Website Redesign"
 *                     description: "Refresh marketing site"
 *                     company:
 *                       id: "7b5f4a6e-0c4a-4bdb-bc73-8b4d7e8a22a1"
 *                       name: "Acme"
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
      archivedAt: null,
    },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      job: true,
      status: true,
      note: true,
      readMarkers: {
        select: {
          agentId: true,
          status: true,
          readAt: true,
          agent: {
            select: {
              id: true,
              AgentId: true,
              name: true,
            },
          },
        },
        orderBy: { readAt: "desc" },
      },
      blockingReason: true,
      archivedAt: true,
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

  return NextResponse.json({ statusCode: 200, tasks: tasks.map(serializeTaskReadMarkers) })
}

/**
 * @openapi
 * /api/agent/tasks:
 *   post:
 *     tags:
 *       - Tasks
 *     summary: Create task in current company
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               projectId:
 *                 type: string
 *                 format: uuid
 *               assignedAgentId:
 *                 type: string
 *                 format: uuid
 *               name:
 *                 type: string
 *               job:
 *                 type: string
 *               status:
 *                 $ref: '#/components/schemas/Status'
 *               note:
 *                 type: string
 *                 nullable: true
 *               readBy:
 *                 type: string
 *                 format: date-time
 *                 nullable: true
 *               blockingReason:
 *                 type: string
 *                 nullable: true
 *             required: [projectId, assignedAgentId, name, job]
 *           example:
 *             projectId: "0fdb2bf7-1f5f-4db2-b927-40335a4adcc4"
 *             assignedAgentId: "550e8400-e29b-41d4-a716-446655440000"
 *             name: "Build landing page"
 *             job: "Implement the responsive landing page"
 *             status: "todo"
 *             note: "Completed responsive layout and deployment wiring."
 *             readBy: []
 *             blockingReason: null
 *     responses:
 *       201:
 *         description: Created task
 *         content:
 *           application/json:
 *             example:
 *               statusCode: 201
 *               task:
 *                 id: "f4b8b6aa-2d17-46bf-8fa7-7dfc38ad87b8"
 *                 name: "Build landing page"
 *                 job: "Implement the responsive landing page"
 *                 status: "todo"
 *                 note: "Completed responsive layout and deployment wiring."
 *                 readBy: []
 *                 blockingReason: null
 *                 assigned:
 *                   id: "550e8400-e29b-41d4-a716-446655440000"
 *                   name: "Build Agent"
 *                   position: "Software Engineer"
 *             schema:
 *               $ref: '#/components/schemas/TaskCreatedResponse'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
export async function POST(request: NextRequest) {
  const agent = await agentAuth(request)

  if (!agent) {
    return NextResponse.json({ statusCode: 401, error: "Unauthorized" }, { status: 401 })
  }

  const body = (await request.json().catch(() => null)) as {
    projectId?: unknown
    assignedAgentId?: unknown
    name?: unknown
    job?: unknown
    status?: unknown
    note?: unknown
    readBy?: unknown
    blockingReason?: unknown
  } | null

  const projectId = typeof body?.projectId === "string" ? body.projectId : ""
  const assignedAgentId = typeof body?.assignedAgentId === "string" ? body.assignedAgentId : ""
  const name = typeof body?.name === "string" ? body.name.trim() : ""
  const job = typeof body?.job === "string" ? body.job.trim() : ""
  const status = typeof body?.status === "string" ? body.status : "todo"
  const note = typeof body?.note === "string" ? body.note.trim() : ""
  const readBy = parseReadByAgentIds(body?.readBy)
  const blockingReason =
    typeof body?.blockingReason === "string" ? body.blockingReason.trim() : ""

  if (!readBy) {
    return NextResponse.json({ statusCode: 400, error: "Invalid read markers" }, { status: 400 })
  }

  if (!projectId || !assignedAgentId || !name || !job) {
    return NextResponse.json(
      { statusCode: 400, error: "Project, agent, name, and job are required." },
      { status: 400 }
    )
  }

  if (!statuses.includes(status as Status)) {
    return NextResponse.json({ statusCode: 400, error: "Invalid task status." }, { status: 400 })
  }

  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      companyId: agent.companyId,
      company: { agents: { some: { id: assignedAgentId } } },
    },
    select: {
      id: true,
      company: {
        select: {
          agents: {
            where: { AgentId: { in: readBy } },
            select: { id: true, AgentId: true },
          },
        },
      },
    },
  })

  if (!project) {
    return NextResponse.json(
      { statusCode: 400, error: "Project or agent not found." },
      { status: 400 }
    )
  }

  if (project.company.agents.length !== readBy.length) {
    return NextResponse.json({ statusCode: 400, error: "Read marker agent not found" }, { status: 400 })
  }

  const task = await prisma.task.create({
    data: {
      projectId,
      assignedAgentId,
      name,
      job,
      status: status as Status,
      note: note || null,
      blockingReason: blockingReason || null,
      readMarkers: {
        create: project.company.agents.map((readAgent) => ({
          agentId: readAgent.id,
          status: status as Status,
        })),
      },
    },
    include: {
      assigned: {
        select: {
          id: true,
          name: true,
          position: true,
        },
      },
      readMarkers: {
        select: {
          agentId: true,
          status: true,
          readAt: true,
          agent: {
            select: {
              id: true,
              AgentId: true,
              name: true,
            },
          },
        },
        orderBy: { readAt: "desc" },
      },
    },
  })

  return NextResponse.json({ statusCode: 201, task: serializeTaskReadMarkers(task) }, { status: 201 })
}

function parseReadByAgentIds(value: unknown) {
  if (value === undefined) return []
  if (!Array.isArray(value)) return null

  const agentIds = value.filter((item): item is string => typeof item === "string" && Boolean(item))

  return agentIds.length === value.length ? Array.from(new Set(agentIds)) : null
}
