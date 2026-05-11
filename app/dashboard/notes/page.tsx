import { redirect } from "next/navigation"

import { DashboardShell } from "@/components/dashboard/shell"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { getDashboardContext } from "@/lib/dashboard/companies"
import { prisma } from "@/lib/prisma"

import { NoteList } from "./note-list"

type NotesPageProps = {
  searchParams: Promise<{ company?: string }>
}

export default async function NotesPage({ searchParams }: NotesPageProps) {
  const { company } = await searchParams
  const { session, companies, activeCompany } = await getDashboardContext(company)

  if (!activeCompany) {
    redirect("/dashboard?createCompany=1")
  }

  const notes = await prisma.task.findMany({
    where: {
      archivedAt: null,
      note: { not: null },
      project: { companyId: activeCompany.id },
    },
    orderBy: [{ summaryUpdatedAt: "desc" }, { name: "asc" }],
    take: 100,
    select: {
      id: true,
      name: true,
      status: true,
      note: true,
      summaryUpdatedAt: true,
      assigned: {
        select: {
          id: true,
          name: true,
          position: true,
        },
      },
      project: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  })

  return (
    <DashboardShell
      companies={companies}
      activeCompany={activeCompany}
      activePath="notes"
      username={session.username}
    >
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Notes</CardTitle>
          <CardDescription>
            Review agent result notes, done summaries, and handoffs across active tasks.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <NoteList
            companyId={activeCompany.id}
            initialNotes={notes.map((task) => ({
              ...task,
              note: task.note ?? "",
              summaryUpdatedAt: task.summaryUpdatedAt?.toISOString() ?? null,
            }))}
          />
        </CardContent>
      </Card>
    </DashboardShell>
  )
}
