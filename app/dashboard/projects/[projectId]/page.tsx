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
  const initialContext = await getDashboardContext()
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      company: {
        userId: initialContext.session.userId,
      },
    },
    include: {
      company: {
        include: {
          agents: {
            orderBy: { name: "asc" },
          },
        },
      },
    },
  })

  if (!project) {
    notFound()
  }

  const { session, companies } = await getDashboardContext(project.companyId)

  return (
    <DashboardShell
      companies={companies}
      activeCompany={project.company}
      activePath="projects"
      username={session.username}
    >
      <ProjectDetailClient initialProject={{ ...project, tasks: [] }} projectId={project.id} />
    </DashboardShell>
  )
}
