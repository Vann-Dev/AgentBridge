import { redirect } from "next/navigation"
import Link from "next/link"

import { DashboardShell } from "@/components/dashboard/shell"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { getDashboardContext } from "@/lib/dashboard/companies"
import { prisma } from "@/lib/prisma"

import { CreateProjectDialog } from "./create-project-dialog"

type ProjectsPageProps = {
  searchParams: Promise<{ company?: string }>
}

export default async function ProjectsPage({ searchParams }: ProjectsPageProps) {
  const { company } = await searchParams
  const { session, companies, activeCompany } = await getDashboardContext(company)

  if (!activeCompany) {
    redirect("/dashboard?createCompany=1")
  }

  const projects = await prisma.project.findMany({
    where: { companyId: activeCompany.id },
    orderBy: { name: "asc" },
  })

  return (
    <DashboardShell
      companies={companies}
      activeCompany={activeCompany}
      activePath="projects"
      username={session.username}
    >
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Projects</CardTitle>
          <CardDescription>
            Track work and task progress for the active company.
          </CardDescription>
          <CardAction>
            <CreateProjectDialog companyId={activeCompany.id} />
          </CardAction>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {projects.length ? (
              projects.map((project) => (
                <Link key={project.id} href={`/dashboard/projects/${project.id}`}>
                  <Card
                    className="h-full transition hover:bg-muted/40 hover:ring-foreground/20"
                    size="sm"
                  >
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
        </CardContent>
      </Card>
    </DashboardShell>
  )
}
