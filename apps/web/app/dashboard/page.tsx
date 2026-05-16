import Link from "next/link"
import {
  BotIcon,
  ClipboardListIcon,
  FileTextIcon,
  NotebookTextIcon,
  ScrollTextIcon,
} from "lucide-react"

import { BrandLogo } from "@/components/brand-logo"
import { CreateCompanyDialog } from "@/components/dashboard/create-company-dialog"
import { DashboardShell } from "@/components/dashboard/shell"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { findReviewReader } from "@/lib/api/review-reader"
import { getDashboardContext } from "@/lib/dashboard/companies"
import { isDoneSummaryUnread } from "@/lib/dashboard/note-read-state"
import { prisma } from "@/lib/prisma"
import { DashboardSummary } from "./dashboard-summary"

type DashboardPageProps = {
  searchParams: Promise<{ company?: string; createCompany?: string }>
}

export default async function DashboardPage({
  searchParams,
}: DashboardPageProps) {
  const { company, createCompany } = await searchParams
  const { session, companies, activeCompany } =
    await getDashboardContext(company)
  const summary = activeCompany
    ? await getDashboardSummary(activeCompany.id)
    : null

  return (
    <DashboardShell
      companies={companies}
      activeCompany={activeCompany}
      activePath="overview"
      username={session.username}
    >
      <div className="space-y-6">
        <div className="overflow-hidden rounded-3xl border border-border bg-card p-6 shadow-sm">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Current company</p>
              <h2 className="mt-1 text-3xl font-semibold tracking-tight">
                {activeCompany?.name ?? "Create your first company"}
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
                {activeCompany?.description ||
                  "Companies group your agents, projects, and tasks. Create one to start."}
              </p>
            </div>
            <BrandLogo
              className="rounded-3xl shadow-lg shadow-primary/10"
              priority
              size={104}
            />
          </div>
          {!activeCompany ? (
            <div className="mt-5 max-w-48">
              <CreateCompanyDialog defaultOpen={createCompany === "1"} />
            </div>
          ) : null}
        </div>
        <DashboardSummary companyCount={companies.length} summary={summary} />
        <OperatorShortcuts
          companyId={activeCompany?.id ?? null}
          summary={summary}
        />
      </div>
    </DashboardShell>
  )
}

function OperatorShortcuts({
  companyId,
  summary,
}: {
  companyId: string | null
  summary: DashboardSummaryData | null
}) {
  const href = (path = "") => dashboardHref(companyId, path)
  const projectHref = summary?.currentProject
    ? href(`/projects/${summary.currentProject.id}`)
    : href("/projects")
  const emptyState = !summary
    ? "Create a company to unlock agent setup, projects, notes, and audit history."
    : summary.projects === 0
      ? "Create a project to give agents a task board and a place to report progress."
      : summary.agents === 0
        ? "Add agents so work can be assigned and reviewed from the dashboard."
        : null

  const shortcuts = [
    {
      title: "Setup docs",
      description: "Review token, agent ID, and operator runbook guidance.",
      href: href("/docs"),
      icon: FileTextIcon,
    },
    {
      title: summary?.currentProject
        ? summary.currentProject.name
        : "Projects & tasks",
      description: summary?.currentProject
        ? "Open the current project task board."
        : "Create or open a project task board.",
      href: projectHref,
      icon: ClipboardListIcon,
    },
    {
      title: "Notes to review",
      description: `${summary?.unreadNotes ?? 0} unread done ${
        (summary?.unreadNotes ?? 0) === 1 ? "summary" : "summaries"
      } for main review.`,
      href: href("/notes"),
      icon: NotebookTextIcon,
    },
    {
      title: "Agent office",
      description: `${summary?.agents ?? 0} configured ${
        (summary?.agents ?? 0) === 1 ? "agent" : "agents"
      } in this company.`,
      href: href("/office"),
      icon: BotIcon,
    },
    {
      title: "Audit log",
      description: "Inspect recent operator and agent changes.",
      href: href("/audit-logs"),
      icon: ScrollTextIcon,
    },
  ]

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Next actions</p>
            <CardTitle className="text-2xl">Operator shortcuts</CardTitle>
          </div>
          {summary?.currentProject ? (
            <p className="text-xs text-muted-foreground">
              Current project: {summary.currentProject.name}
            </p>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {emptyState ? (
          <div className="rounded-2xl border border-dashed border-border bg-muted/40 p-4 text-sm text-muted-foreground">
            {emptyState}
          </div>
        ) : null}
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {shortcuts.map((shortcut) => {
            const Icon = shortcut.icon
            return (
              <Link
                key={shortcut.title}
                href={shortcut.href}
                className="group rounded-2xl border border-border bg-background/80 p-4 transition hover:border-primary/30 hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15 transition group-hover:bg-primary/15">
                  <Icon className="size-4" />
                </span>
                <span className="mt-3 block text-sm font-semibold">
                  {shortcut.title}
                </span>
                <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                  {shortcut.description}
                </span>
              </Link>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

function dashboardHref(companyId: string | null, path = "") {
  const search = companyId ? `?company=${companyId}` : ""
  return `/dashboard${path}${search}`
}

type DashboardSummaryData = {
  agents: number
  projects: number
  tasks: Partial<Record<"todo" | "inprogress" | "blocked" | "done", number>>
  unreadNotes: number
  currentProject: { id: string; name: string } | null
}

async function getDashboardSummary(
  companyId: string
): Promise<DashboardSummaryData> {
  const reviewReader = await findReviewReader(companyId)
  const [agents, projects, currentProject, tasks, notes] = await Promise.all([
    prisma.agent.count({ where: { companyId } }),
    prisma.project.count({ where: { companyId } }),
    prisma.project.findFirst({
      where: { companyId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.task.groupBy({
      by: ["status"],
      where: { archivedAt: null, project: { companyId } },
      _count: { _all: true },
    }),
    prisma.task.findMany({
      where: {
        archivedAt: null,
        note: { not: null },
        status: "done",
        project: { companyId },
        ...(reviewReader ? {} : { id: "__no_review_reader__" }),
      },
      select: {
        summaryUpdatedAt: true,
        readMarkers: {
          where: {
            status: "done",
            ...(reviewReader ? { agentId: reviewReader.id } : { agentId: "__no_review_reader__" }),
          },
          select: { readAt: true },
        },
      },
    }),
  ])
  const taskCounts = Object.fromEntries(
    tasks.map((task) => [task.status, task._count._all])
  )
  const unreadNotes = notes.filter((task) => {
    const readAt = task.readMarkers[0]?.readAt
    return isDoneSummaryUnread({
      readAt,
      summaryUpdatedAt: task.summaryUpdatedAt,
    })
  }).length

  return {
    agents,
    projects,
    tasks: taskCounts,
    unreadNotes,
    currentProject,
  }
}
