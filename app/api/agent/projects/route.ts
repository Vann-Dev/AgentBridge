import { NextRequest, NextResponse } from "next/server"

import { agentAuth } from "@/lib/agent-auth"
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
 *                   tasks: []
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
    return NextResponse.json({ statusCode: 401, error: "Unauthorized" }, { status: 401 })
  }

  const body = (await request.json().catch(() => null)) as {
    name?: unknown
    description?: unknown
  } | null

  const name = typeof body?.name === "string" ? body.name.trim() : ""
  const description = typeof body?.description === "string" ? body.description.trim() : ""

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
    },
    select: {
      id: true,
      name: true,
      description: true,
    },
  })

  return NextResponse.json({ statusCode: 201, project }, { status: 201 })
}
