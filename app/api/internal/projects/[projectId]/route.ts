import { NextResponse } from "next/server"

import { notFound, requireInternalSession } from "@/lib/api/internal"
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
      company: {
        include: {
          agents: {
            orderBy: { name: "asc" },
            select: {
              id: true,
              name: true,
              position: true,
            },
          },
        },
      },
      tasks: {
        include: {
          assigned: {
            select: {
              id: true,
              name: true,
              position: true,
            },
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
