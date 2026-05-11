import { NextRequest, NextResponse } from "next/server"

import { agentAuth } from "@/lib/agent-auth"
import { serializeTaskReadMarkers } from "@/lib/api/task-read-markers"
import { prisma } from "@/lib/prisma"

type RouteContext = {
  params: Promise<{ projectId: string }>
}

/**
 * @openapi
 * /api/agent/projects/{projectId}:
 *   get:
 *     tags:
 *       - Projects
 *     summary: Get project in current company
 *     parameters:
 *       - $ref: '#/components/parameters/ProjectId'
 *     responses:
 *       200:
 *         description: Project in current company
 *         content:
 *           application/json:
 *             example:
 *               statusCode: 200
 *               project:
 *                 id: "0fdb2bf7-1f5f-4db2-b927-40335a4adcc4"
 *                 name: "Website Redesign"
 *                 description: "Refresh marketing site"
 *                 tasks:
 *                   - id: "f4b8b6aa-2d17-46bf-8fa7-7dfc38ad87b8"
 *                     name: "Build landing page"
 *                     job: "Implement the responsive landing page"
 *                     status: "done"
 *                     note: "Completed responsive layout and deployment wiring."
 *                     readBy: []
 *                     blockingReason: null
 *                     archivedAt: null
 *                     assigned:
 *                       id: "550e8400-e29b-41d4-a716-446655440000"
 *                       name: "Build Agent"
 *                       position: "Software Engineer"
 *             schema:
 *               $ref: '#/components/schemas/ProjectWithTasksResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
export async function GET(request: NextRequest, { params }: RouteContext) {
  const agent = await agentAuth(request)

  if (!agent) {
    return NextResponse.json({ statusCode: 401, error: "Unauthorized" }, { status: 401 })
  }

  const { projectId } = await params
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      companyId: agent.companyId,
    },
    select: {
      id: true,
      name: true,
      description: true,
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
            select: { dependencyTask: { select: { id: true, name: true, status: true } } },
            orderBy: { createdAt: "asc" },
          },
          unblocksDependencies: {
            select: { blockedTask: { select: { id: true, name: true, status: true } } },
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

  if (!project) {
    return NextResponse.json({ statusCode: 404, error: "Project not found" }, { status: 404 })
  }

  return NextResponse.json({
    statusCode: 200,
    project: {
      ...project,
      tasks: project.tasks.map(serializeTaskReadMarkers),
    },
  })
}

/**
 * @openapi
 * /api/agent/projects/{projectId}:
 *   patch:
 *     tags:
 *       - Projects
 *     summary: Update project in current company
 *     parameters:
 *       - $ref: '#/components/parameters/ProjectId'
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
 *             minProperties: 1
 *           example:
 *             name: "Website Refresh"
 *             description: "Refresh marketing and pricing pages"
 *     responses:
 *       200:
 *         description: Updated project
 *         content:
 *           application/json:
 *             example:
 *               statusCode: 200
 *               project:
 *                 id: "0fdb2bf7-1f5f-4db2-b927-40335a4adcc4"
 *                 name: "Website Refresh"
 *                 description: "Refresh marketing and pricing pages"
 *             schema:
 *               $ref: '#/components/schemas/ProjectResponse'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const agent = await agentAuth(request)

  if (!agent) {
    return NextResponse.json({ statusCode: 401, error: "Unauthorized" }, { status: 401 })
  }

  const body = (await request.json().catch(() => null)) as {
    name?: unknown
    description?: unknown
  } | null

  const name = typeof body?.name === "string" ? body.name.trim() : undefined
  const description =
    typeof body?.description === "string" ? body.description.trim() : undefined

  if (name === "") {
    return NextResponse.json(
      { statusCode: 400, error: "Project name is required." },
      { status: 400 }
    )
  }

  if (name === undefined && description === undefined) {
    return NextResponse.json(
      { statusCode: 400, error: "No project updates provided." },
      { status: 400 }
    )
  }

  const { projectId } = await params
  const existingProject = await prisma.project.findFirst({
    where: { id: projectId, companyId: agent.companyId },
    select: { id: true },
  })

  if (!existingProject) {
    return NextResponse.json({ statusCode: 404, error: "Project not found" }, { status: 404 })
  }

  const project = await prisma.project.update({
    where: { id: existingProject.id },
    data: {
      ...(name !== undefined ? { name } : {}),
      ...(description !== undefined ? { description } : {}),
    },
    select: {
      id: true,
      name: true,
      description: true,
    },
  })

  return NextResponse.json({ statusCode: 200, project })
}

/**
 * @openapi
 * /api/agent/projects/{projectId}:
 *   delete:
 *     tags:
 *       - Projects
 *     summary: Delete project in current company
 *     parameters:
 *       - $ref: '#/components/parameters/ProjectId'
 *     responses:
 *       200:
 *         description: Deleted project id
 *         content:
 *           application/json:
 *             example:
 *               statusCode: 200
 *               projectId: "0fdb2bf7-1f5f-4db2-b927-40335a4adcc4"
 *             schema:
 *               $ref: '#/components/schemas/DeleteProjectResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const agent = await agentAuth(request)

  if (!agent) {
    return NextResponse.json({ statusCode: 401, error: "Unauthorized" }, { status: 401 })
  }

  const { projectId } = await params
  const project = await prisma.project.findFirst({
    where: { id: projectId, companyId: agent.companyId },
    select: { id: true },
  })

  if (!project) {
    return NextResponse.json({ statusCode: 404, error: "Project not found" }, { status: 404 })
  }

  await prisma.project.delete({ where: { id: project.id } })

  return NextResponse.json({ statusCode: 200, projectId: project.id })
}
