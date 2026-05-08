import { redirect } from "next/navigation"

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
import { ProjectsList } from "./projects-list"

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
          <ProjectsList companyId={activeCompany.id} initialProjects={projects} />
        </CardContent>
      </Card>
    </DashboardShell>
  )
}
