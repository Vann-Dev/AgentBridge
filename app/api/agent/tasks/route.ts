import { NextRequest, NextResponse } from "next/server"

import { Status } from "@/generated/prisma/enums"
import { agentAuth } from "@/lib/agent-auth"
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
 *                   natsukiReadAt: null
 *                   blockingReason: null
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
    },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      job: true,
      status: true,
      note: true,
      natsukiReadAt: true,
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
 *               natsukiReadAt:
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
 *             natsukiReadAt: null
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
 *                 natsukiReadAt: null
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
    natsukiReadAt?: unknown
    blockingReason?: unknown
  } | null

  const projectId = typeof body?.projectId === "string" ? body.projectId : ""
  const assignedAgentId = typeof body?.assignedAgentId === "string" ? body.assignedAgentId : ""
  const name = typeof body?.name === "string" ? body.name.trim() : ""
  const job = typeof body?.job === "string" ? body.job.trim() : ""
  const status = typeof body?.status === "string" ? body.status : "todo"
  const note = typeof body?.note === "string" ? body.note.trim() : ""
  const natsukiReadAt = parseReadMarker(body?.natsukiReadAt)
  const blockingReason =
    typeof body?.blockingReason === "string" ? body.blockingReason.trim() : ""

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
    select: { id: true },
  })

  if (!project) {
    return NextResponse.json(
      { statusCode: 400, error: "Project or agent not found." },
      { status: 400 }
    )
  }

  const task = await prisma.task.create({
    data: {
      projectId,
      assignedAgentId,
      name,
      job,
      status: status as Status,
      note: note || null,
      natsukiReadAt,
      blockingReason: blockingReason || null,
    },
    include: {
      assigned: {
        select: {
          id: true,
          name: true,
          position: true,
        },
      },
    },
  })

  return NextResponse.json({ statusCode: 201, task }, { status: 201 })
}

function parseReadMarker(value: unknown) {
  if (value === true || value === "true") return new Date()
  if (value === null || value === false || value === "" || value === "false") return null
  if (typeof value !== "string") return null

  const date = new Date(value)

  return Number.isNaN(date.getTime()) ? null : date
}
