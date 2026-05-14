import { NextRequest, NextResponse } from "next/server"

import { agentAuth } from "@/lib/agent-auth"
import {
  projectAgentSelect,
  serializeProjectAgents,
} from "@/lib/api/project-agents"
import { serializeTaskReadMarkers } from "@/lib/api/task-read-markers"
import { prisma } from "@/lib/prisma"

/**
 * @openapi
 * /api/agent/projects:
 *   get:
 *     tags:
 *       - Projects
 *     summary: List projects in current company
 *     responses:
 *       200:
 *         description: Projects in current company
 *         content:
 *           application/json:
 *             example:
 *               statusCode: 200
 *               projects:
 *                 - id: "0fdb2bf7-1f5f-4db2-b927-40335a4adcc4"
 *                   name: "Website Redesign"
 *                   description: "Refresh marketing site"
 *                   projectAgents:
 *                     - id: "550e8400-e29b-41d4-a716-446655440000"
 *                       AgentId: "builder"
 *                       name: "Build Agent"
 *                       position: "Software Engineer"
 *                   tasks:
 *                     - id: "f4b8b6aa-2d17-46bf-8fa7-7dfc38ad87b8"
 *                       name: "Build landing page"
 *                       job: "Implement the responsive landing page"
 *                       status: "done"
 *                       note: "Completed responsive layout and deployment wiring."
 *                       summaryUpdatedAt: "2026-05-11T08:40:00.000Z"
 *                       readBy: []
 *                       blockingReason: null
 *                       archivedAt: null
 *                       taskUpdatedAt: "2026-05-11T08:40:00.000Z"
 *                       taskUpdatedById: "550e8400-e29b-41d4-a716-446655440000"
 *                       taskUpdatedByName: "Build Agent"
 *                       taskUpdatedByType: "agent"
 *                       assigned:
 *                         id: "550e8400-e29b-41d4-a716-446655440000"
 *                         name: "Build Agent"
 *                         position: "Software Engineer"
 *             schema:
 *               $ref: '#/components/schemas/ProjectsResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
export async function GET(request: NextRequest) {
  const agent = await agentAuth(request)

  if (!agent) {
    return NextResponse.json(
      { statusCode: 401, error: "Unauthorized" },
      { status: 401 }
    )
  }

  const { companyId } = agent

  const projects = await prisma.project.findMany({
    where: {
      companyId,
    },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      description: true,
      agents: {
        orderBy: { agent: { name: "asc" } },
        select: projectAgentSelect,
      },
      tasks: {
        where: { archivedAt: null },
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          job: true,
          status: true,
          note: true,
          summaryUpdatedAt: true,
          taskUpdatedAt: true,
          taskUpdatedById: true,
          taskUpdatedByName: true,
          taskUpdatedByType: true,
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
          blockedByDependencies: {
            select: {
              dependencyTask: { select: { id: true, name: true, status: true } },
            },
            orderBy: { createdAt: "asc" },
          },
          unblocksDependencies: {
            select: {
              blockedTask: { select: { id: true, name: true, status: true } },
            },
            orderBy: { createdAt: "asc" },
          },
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

  return NextResponse.json({
    statusCode: 200,
    projects: projects.map((project) => ({
      ...project,
      projectAgents: serializeProjectAgents(project.agents),
      agents: undefined,
      tasks: project.tasks.map(serializeTaskReadMarkers),
    })),
  })
}

/**
 * @openapi
 * /api/agent/projects:
 *   post:
 *     tags:
 *       - Projects
 *     summary: Create project in current company
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *             required: [name]
 *           example:
 *             name: "Website Redesign"
 *             description: "Refresh marketing site"
 *         description: The authenticated agent is linked to newly-created projects automatically so agent workflows can create initial tasks.
 *     responses:
 *       201:
 *         description: Created project
 *         content:
 *           application/json:
 *             example:
 *               statusCode: 201
 *               project:
 *                 id: "0fdb2bf7-1f5f-4db2-b927-40335a4adcc4"
 *                 name: "Website Redesign"
 *                 description: "Refresh marketing site"
 *             schema:
 *               $ref: '#/components/schemas/ProjectResponse'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
export async function POST(request: NextRequest) {
  const agent = await agentAuth(request)

  if (!agent) {
    return NextResponse.json(
      { statusCode: 401, error: "Unauthorized" },
      { status: 401 }
    )
  }

  const body = (await request.json().catch(() => null)) as {
    name?: unknown
    description?: unknown
  } | null

  const name = typeof body?.name === "string" ? body.name.trim() : ""
  const description =
    typeof body?.description === "string" ? body.description.trim() : ""

  if (!name) {
    return NextResponse.json(
      { statusCode: 400, error: "Project name is required." },
      { status: 400 }
    )
  }

  const project = await prisma.project.create({
    data: {
      companyId: agent.companyId,
      name,
      description,
      agents: {
        create: {
          agentId: agent.id,
        },
      },
    },
    select: {
      id: true,
      name: true,
      description: true,
    },
  })

  return NextResponse.json({ statusCode: 201, project }, { status: 201 })
}
