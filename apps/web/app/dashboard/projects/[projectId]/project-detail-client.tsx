"use client"

import Link from "next/link"
import { useQuery } from "@tanstack/react-query"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { CreateTaskDialog } from "./create-task-dialog"
import { ProjectAgentsManager } from "./project-agents-manager"
import { ProjectOverview, ProjectOverviewSkeleton } from "./project-overview"
import { TaskKanban, TaskKanbanSkeleton } from "./task-kanban"
import { getProjectDetailAction } from "./actions"
import type { ProjectDetailData } from "./types"

type ProjectDetailClientProps = {
  initialProject: ProjectDetailData
  projectId: string
}

export function ProjectDetailClient({ initialProject, projectId }: ProjectDetailClientProps) {
  const projectQuery = useQuery({
    queryKey: ["project", projectId],
    queryFn: async () => {
      const result = await getProjectDetailAction(projectId)

      if (!result.ok) {
        throw new Error(result.error)
      }

      return { project: result.project }
    },
    initialData: { project: initialProject },
  })
  const project = projectQuery.data.project
  const projectDiagnostics = undefined
  const agents = project.projectAgents ?? []
  const companyAgents = project.company?.agents ?? []
  const tasks = project.tasks ?? []
  const isLoadingProjectData = projectQuery.isFetching && tasks.length === 0

  return (
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
            <CreateTaskDialog companyId={project.companyId} projectId={project.id} agents={agents} />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <ProjectAgentsManager
            companyAgents={companyAgents}
            companyId={project.companyId}
            projectAgents={agents}
            projectId={project.id}
          />
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href={`/dashboard/projects?company=${project.companyId}`}>
                Back to projects
              </Link>
            </Button>
            <Button asChild variant="secondary">
              <a href="#project-overview">Overview</a>
            </Button>
            <Button asChild variant="ghost">
              <a href="#project-kanban">Kanban board</a>
            </Button>
          </div>
        </CardContent>
      </Card>

      {projectQuery.isError ? (
        <div className="flex flex-col gap-3 rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive sm:flex-row sm:items-center sm:justify-between">
          <p>{projectQuery.error.message}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => projectQuery.refetch()}
          >
            Retry
          </Button>
        </div>
      ) : null}

      <section id="project-overview" className="scroll-mt-6">
        {isLoadingProjectData ? (
          <ProjectOverviewSkeleton />
        ) : (
          <ProjectOverview project={project} diagnostics={projectDiagnostics} />
        )}
      </section>

      <section id="project-kanban" className="scroll-mt-6">
        {isLoadingProjectData ? (
          <TaskKanbanSkeleton />
        ) : (
          <TaskKanban
            agents={agents}
            companyId={project.companyId}
            projectId={project.id}
            tasks={tasks}
          />
        )}
      </section>
    </div>
  )
}
