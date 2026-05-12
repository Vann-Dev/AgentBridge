import { redirect } from "next/navigation"

import { DashboardShell } from "@/components/dashboard/shell"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { findReviewReader, getReviewReaderLabel } from "@/lib/api/review-reader"
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

  const reviewReader = await findReviewReader(activeCompany.id)
  const notes = reviewReader
    ? await prisma.task.findMany({
    where: {
      archivedAt: null,
      note: { not: null },
      status: "done",
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
      readMarkers: {
        where: {
          status: "done",
          agentId: reviewReader.id,
        },
        select: { readAt: true },
      },
    },
      })
    : []
  const unreadNotes = notes.filter((task) => {
    const readAt = task.readMarkers[0]?.readAt

    return !readAt || !task.summaryUpdatedAt || readAt < task.summaryUpdatedAt
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
            Review unread done summaries. Mark reviewed cards disappear from this queue for{" "}
            {getReviewReaderLabel(reviewReader)}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <NoteList
            companyId={activeCompany.id}
            reviewReader={reviewReader}
            initialNotes={unreadNotes.map((task) => ({
              id: task.id,
              name: task.name,
              status: task.status,
              note: task.note ?? "",
              summaryUpdatedAt: task.summaryUpdatedAt?.toISOString() ?? null,
              assigned: task.assigned,
              project: task.project,
            }))}
          />
        </CardContent>
      </Card>
    </DashboardShell>
  )
}
