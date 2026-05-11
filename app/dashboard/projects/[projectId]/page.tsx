import { notFound } from "next/navigation"

import { DashboardShell } from "@/components/dashboard/shell"
import { getDashboardContext } from "@/lib/dashboard/companies"
import { prisma } from "@/lib/prisma"

import { ProjectDetailClient } from "./project-detail-client"

type ProjectDetailPageProps = {
  params: Promise<{ projectId: string }>
}

export default async function ProjectDetailPage({ params }: ProjectDetailPageProps) {
  const { projectId } = await params
  const { session, companies } = await getDashboardContext()
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      company: {
        userId: session.userId,
      },
    },
    select: {
      id: true,
      companyId: true,
      name: true,
      description: true,
      company: {
        select: {
          id: true,
          name: true,
          agents: {
            orderBy: { name: "asc" },
            select: {
              id: true,
              AgentId: true,
              name: true,
              position: true,
            },
          },
        },
      },
      agents: {
        orderBy: { agent: { name: "asc" } },
        select: {
          agent: {
            select: {
              id: true,
              AgentId: true,
              name: true,
              position: true,
            },
          },
        },
      },
    },
  })

  if (!project) {
    notFound()
  }

  const { agents, ...projectData } = project

  return (
    <DashboardShell
      companies={companies}
      activeCompany={project.company}
      activePath="projects"
      username={session.username}
    >
      <ProjectDetailClient
        initialProject={{
          ...projectData,
          projectAgents: agents.map(({ agent }) => agent),
          tasks: [],
        }}
        projectId={project.id}
      />
    </DashboardShell>
  )
}
