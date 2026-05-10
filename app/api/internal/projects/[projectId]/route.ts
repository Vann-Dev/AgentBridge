import { NextResponse } from "next/server"

import { badRequest, notFound, requireInternalSession } from "@/lib/api/internal"
import { prisma } from "@/lib/prisma"

type RouteContext = {
  params: Promise<{ projectId: string }>
}

export async function GET(_request: Request, { params }: RouteContext) {
  const { session, response } = await requireInternalSession()

  if (response) return response

  const { projectId } = await params
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      company: { userId: session.userId },
    },
    include: {
      tasks: {
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
        orderBy: { name: "asc" },
      },
    },
  })

  if (!project) {
    return notFound("Project not found.")
  }

  return NextResponse.json({ statusCode: 200, project })
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const { session, response } = await requireInternalSession()

  if (response) return response

  const body = (await request.json().catch(() => null)) as { name?: unknown } | null
  const name = typeof body?.name === "string" ? body.name.trim() : ""

  if (!name) {
    return badRequest("Project name is required.")
  }

  const { projectId } = await params
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      company: { userId: session.userId },
    },
    select: { id: true },
  })

  if (!project) {
    return notFound("Project not found.")
  }

  const updatedProject = await prisma.project.update({
    where: { id: project.id },
    data: { name },
  })

  return NextResponse.json({ statusCode: 200, project: updatedProject })
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const { session, response } = await requireInternalSession()

  if (response) return response

  const { projectId } = await params
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      company: { userId: session.userId },
    },
    select: { id: true },
  })

  if (!project) {
    return notFound("Project not found.")
  }

  await prisma.project.delete({ where: { id: project.id } })

  return NextResponse.json({ statusCode: 200, projectId: project.id })
}
