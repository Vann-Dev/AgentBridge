import Link from "next/link"
import { notFound } from "next/navigation"

import { DashboardShell } from "@/components/dashboard/shell"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { getDashboardContext } from "@/lib/dashboard/companies"
import { prisma } from "@/lib/prisma"

import { CreateTaskDialog } from "./create-task-dialog"
import { TaskKanban } from "./task-kanban"

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
      tasks: {
        where: { archivedAt: null },
        include: {
          assigned: true,
          readMarkers: {
            include: {
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
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="text-3xl">{project.name}</CardTitle>
                <CardDescription className="mt-2 max-w-2xl leading-6">
                  {project.description || "No description"}
                </CardDescription>
              </div>
              <CreateTaskDialog projectId={project.id} agents={project.company.agents} />
            </div>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline">
              <Link href={`/dashboard/projects?company=${project.companyId}`}>
                Back to projects
              </Link>
            </Button>
          </CardContent>
        </Card>

        <TaskKanban
          agents={project.company.agents}
          projectId={project.id}
          tasks={project.tasks}
        />
      </div>
    </DashboardShell>
  )
}
