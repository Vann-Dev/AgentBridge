"use client"

import Link from "next/link"
import { useQuery } from "@tanstack/react-query"

import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { apiJson } from "@/lib/api/client"

type ProjectRow = {
  id: string
  name: string
  description: string
}

type ProjectsListProps = {
  companyId: string
  initialProjects: ProjectRow[]
}

export function ProjectsList({ companyId, initialProjects }: ProjectsListProps) {
  const projectsQuery = useQuery({
    queryKey: ["projects", companyId],
    queryFn: () =>
      apiJson<{ projects: ProjectRow[] }>(`/api/internal/projects?companyId=${companyId}`),
    initialData: { projects: initialProjects },
  })
  const projects = projectsQuery.data.projects

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {projects.length ? (
        projects.map((project) => (
          <Link key={project.id} href={`/dashboard/projects/${project.id}`}>
            <Card className="h-full transition hover:bg-muted/40 hover:ring-foreground/20" size="sm">
              <CardHeader>
                <CardTitle>{project.name}</CardTitle>
                <CardDescription>{project.description || "No description"}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))
      ) : (
        <p className="rounded-2xl bg-muted p-6 text-sm text-muted-foreground md:col-span-2 xl:col-span-3">
          No projects yet.
        </p>
      )}
    </div>
  )
}
