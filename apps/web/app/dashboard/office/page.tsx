import { redirect } from "next/navigation"
import {
  AlertTriangleIcon,
  BotIcon,
  CheckCircle2Icon,
  CircleDashedIcon,
  Clock3Icon,
  CoffeeIcon,
  LaptopIcon,
  RadioIcon,
  SparklesIcon,
} from "lucide-react"

import { DashboardShell } from "@/components/dashboard/shell"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { getDashboardContext } from "@/lib/dashboard/companies"
import { cn } from "@/lib/utils"
import { prisma } from "@/lib/prisma"

const taskStatuses = ["todo", "inprogress", "blocked", "done"] as const

type TaskStatus = (typeof taskStatuses)[number]
type AgentState =
  | "error"
  | "blocked"
  | "working"
  | "ready"
  | "recentlyDone"
  | "idle"
  | "offline"

type OfficeTask = {
  id: string
  name: string
  status: TaskStatus
  note: string | null
  summaryUpdatedAt: Date | null
  taskUpdatedAt: Date
  project: {
    name: string
  }
}

type OfficeAgent = {
  id: string
  AgentId: string
  name: string
  description: string
  position: string
  tasks: OfficeTask[]
}

type AgentSummary = {
  agent: OfficeAgent
  activeTaskCount: number
  doneTaskCount: number
  counts: Record<TaskStatus, number>
  state: AgentState
  stateLabel: string
  stateDescription: string
  lastActivity: Date | null
  focusTask: OfficeTask | null
  recentDoneTask: OfficeTask | null
}

type OfficePageProps = {
  searchParams: Promise<{ company?: string }>
}

const stateStyles: Record<
  AgentState,
  {
    label: string
    className: string
    badgeClassName: string
    icon: typeof BotIcon
  }
> = {
  error: {
    label: "Error",
    className: "border-destructive/40 bg-destructive/10",
    badgeClassName: "border-destructive/30 bg-destructive/10 text-destructive",
    icon: AlertTriangleIcon,
  },
  blocked: {
    label: "Blocked",
    className: "border-amber-500/40 bg-amber-500/10",
    badgeClassName: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    icon: AlertTriangleIcon,
  },
  working: {
    label: "Working",
    className: "border-sky-500/40 bg-sky-500/10",
    badgeClassName: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300",
    icon: LaptopIcon,
  },
  ready: {
    label: "Ready",
    className: "border-emerald-500/40 bg-emerald-500/10",
    badgeClassName: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    icon: RadioIcon,
  },
  recentlyDone: {
    label: "Recently done",
    className: "border-primary/40 bg-primary/10",
    badgeClassName: "border-primary/30 bg-primary/10 text-primary",
    icon: CheckCircle2Icon,
  },
  idle: {
    label: "Idle",
    className: "border-border bg-muted/40",
    badgeClassName: "border-border bg-muted text-muted-foreground",
    icon: CoffeeIcon,
  },
  offline: {
    label: "Offline",
    className: "border-border bg-background opacity-80",
    badgeClassName: "border-border bg-background text-muted-foreground",
    icon: CircleDashedIcon,
  },
}

export default async function OfficePage({ searchParams }: OfficePageProps) {
  const { company } = await searchParams
  const { session, companies, activeCompany } = await getDashboardContext(company)

  if (!activeCompany) {
    redirect("/dashboard?createCompany=1")
  }

  const summaries = await getAgentSummaries(activeCompany.id)
  const stateCounts = summaries.reduce(
    (counts, summary) => {
      counts[summary.state] = (counts[summary.state] ?? 0) + 1
      return counts
    },
    {} as Partial<Record<AgentState, number>>
  )

  return (
    <DashboardShell
      companies={companies}
      activeCompany={activeCompany}
      activePath="office"
      username={session.username}
    >
      <div className="space-y-6">
        <section className="overflow-hidden rounded-3xl border border-border bg-card p-6 shadow-sm">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
                Agent HQ
              </p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight">
                Visual office
              </h2>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                A compact command-room view of every agent desk, current work state,
                active queue, done summaries, and latest task activity for this company.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:min-w-[28rem]">
              <OfficeStat label="Agents" value={summaries.length} />
              <OfficeStat label="Working" value={stateCounts.working ?? 0} />
              <OfficeStat label="Blocked" value={stateCounts.blocked ?? 0} tone="danger" />
              <OfficeStat label="Ready" value={stateCounts.ready ?? 0} />
            </div>
          </div>
        </section>

        {summaries.length ? (
          <section className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-3">
            {summaries.map((summary) => (
              <AgentDesk key={summary.agent.id} summary={summary} />
            ))}
          </section>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>No desks yet</CardTitle>
              <CardDescription>
                Create agents to populate the office floor.
              </CardDescription>
            </CardHeader>
          </Card>
        )}
      </div>
    </DashboardShell>
  )
}

async function getAgentSummaries(companyId: string): Promise<AgentSummary[]> {
  const agents = await prisma.agent.findMany({
    where: { companyId },
    orderBy: { name: "asc" },
    select: {
      id: true,
      AgentId: true,
      name: true,
      description: true,
      position: true,
      tasks: {
        where: { archivedAt: null },
        orderBy: { taskUpdatedAt: "desc" },
        select: {
          id: true,
          name: true,
          status: true,
          note: true,
          summaryUpdatedAt: true,
          taskUpdatedAt: true,
          project: {
            select: { name: true },
          },
        },
      },
    },
  })

  return agents.map((agent) => summarizeAgent(agent))
}

function summarizeAgent(agent: OfficeAgent): AgentSummary {
  const counts = Object.fromEntries(
    taskStatuses.map((status) => [
      status,
      agent.tasks.filter((task) => task.status === status).length,
    ])
  ) as Record<TaskStatus, number>
  const focusTask =
    agent.tasks.find((task) => task.status === "blocked") ??
    agent.tasks.find((task) => task.status === "inprogress") ??
    agent.tasks.find((task) => task.status === "todo") ??
    null
  const recentDoneTask = agent.tasks.find((task) => task.status === "done") ?? null
  const activeTaskCount = counts.todo + counts.inprogress + counts.blocked
  const lastActivity = agent.tasks[0]?.taskUpdatedAt ?? null
  const state = getAgentState(counts, recentDoneTask, lastActivity)

  return {
    agent,
    activeTaskCount,
    doneTaskCount: counts.done,
    counts,
    state,
    stateLabel: stateStyles[state].label,
    stateDescription: getStateDescription(state, focusTask, recentDoneTask),
    lastActivity,
    focusTask,
    recentDoneTask,
  }
}

function getAgentState(
  counts: Record<TaskStatus, number>,
  recentDoneTask: OfficeTask | null,
  lastActivity: Date | null
): AgentState {
  if (counts.blocked > 0) {
    return "blocked"
  }

  if (counts.inprogress > 0) {
    return "working"
  }

  if (counts.todo > 0) {
    return "ready"
  }

  if (recentDoneTask && isWithinDays(recentDoneTask.summaryUpdatedAt ?? recentDoneTask.taskUpdatedAt, 3)) {
    return "recentlyDone"
  }

  if (!lastActivity) {
    return "idle"
  }

  return "idle"
}

function getStateDescription(
  state: AgentState,
  focusTask: OfficeTask | null,
  recentDoneTask: OfficeTask | null
) {
  if (state === "blocked" && focusTask) {
    return `Blocked on ${focusTask.name}`
  }

  if (state === "working" && focusTask) {
    return `Working on ${focusTask.name}`
  }

  if (state === "ready" && focusTask) {
    return `Ready for ${focusTask.name}`
  }

  if (state === "recentlyDone" && recentDoneTask) {
    return `Recently finished ${recentDoneTask.name}`
  }

  if (state === "offline") {
    return "No cron or schedule signal is available."
  }

  return "No active assigned tasks."
}

function AgentDesk({ summary }: { summary: AgentSummary }) {
  const StateIcon = stateStyles[summary.state].icon

  return (
    <Card className={cn("relative overflow-hidden", stateStyles[summary.state].className)}>
      <div className="absolute right-5 top-5 text-6xl font-black leading-none text-foreground/[0.04]">
        {summary.agent.name.slice(0, 1).toUpperCase()}
      </div>
      <CardHeader className="relative space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-14 shrink-0 items-center justify-center rounded-3xl border border-border bg-background shadow-sm">
              <BotIcon className="size-7 text-primary" />
            </div>
            <div className="min-w-0">
              <CardTitle className="truncate text-xl">{summary.agent.name}</CardTitle>
              <CardDescription className="truncate">
                {summary.agent.position}
              </CardDescription>
            </div>
          </div>
          <Badge className={stateStyles[summary.state].badgeClassName} variant="outline">
            <StateIcon className="size-3" />
            {summary.stateLabel}
          </Badge>
        </div>
        <p className="line-clamp-2 text-sm text-muted-foreground">
          {summary.agent.description || "No agent description yet."}
        </p>
      </CardHeader>
      <CardContent className="relative space-y-4">
        <div className="rounded-3xl border border-border/70 bg-background/80 p-4 shadow-inner">
          <div className="flex items-center gap-3">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <LaptopIcon className="size-6" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium">{summary.stateDescription}</p>
              <p className="text-xs text-muted-foreground">
                AgentId: <code>{summary.agent.AgentId}</code>
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2 text-center text-sm">
          <DeskMetric label="Todo" value={summary.counts.todo} />
          <DeskMetric label="Doing" value={summary.counts.inprogress} />
          <DeskMetric label="Blocked" value={summary.counts.blocked} tone="danger" />
          <DeskMetric label="Done" value={summary.doneTaskCount} />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <TaskSnapshot label="Focus" task={summary.focusTask} empty="No active task" />
          <TaskSnapshot label="Latest done" task={summary.recentDoneTask} empty="No done task" />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-background/70 px-3 py-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Clock3Icon className="size-3.5" />
            Last activity: {summary.lastActivity ? formatDate(summary.lastActivity) : "No task activity"}
          </span>
          <span>{summary.activeTaskCount} active</span>
        </div>
      </CardContent>
    </Card>
  )
}

function OfficeStat({
  label,
  value,
  tone = "default",
}: {
  label: string
  value: number
  tone?: "default" | "danger"
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border bg-background/80 p-3",
        tone === "danger" ? "border-amber-500/30" : "border-border"
      )}
    >
      <p className="text-2xl font-semibold">{value}</p>
      <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </p>
    </div>
  )
}

function DeskMetric({
  label,
  value,
  tone = "default",
}: {
  label: string
  value: number
  tone?: "default" | "danger"
}) {
  return (
    <div className="rounded-2xl bg-background/75 p-2">
      <p className={cn("font-semibold", tone === "danger" ? "text-amber-600 dark:text-amber-300" : "")}>{value}</p>
      <p className="text-[0.65rem] uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
    </div>
  )
}

function TaskSnapshot({
  label,
  task,
  empty,
}: {
  label: string
  task: OfficeTask | null
  empty: string
}) {
  return (
    <div className="rounded-2xl bg-background/75 p-3 text-sm">
      <p className="flex items-center gap-1.5 text-xs uppercase tracking-[0.16em] text-muted-foreground">
        <SparklesIcon className="size-3" />
        {label}
      </p>
      {task ? (
        <div className="mt-2 space-y-1">
          <p className="line-clamp-2 font-medium">{task.name}</p>
          <p className="truncate text-xs text-muted-foreground">{task.project.name}</p>
          {task.note ? (
            <p className="line-clamp-2 text-xs text-muted-foreground">{task.note}</p>
          ) : null}
        </div>
      ) : (
        <p className="mt-2 text-muted-foreground">{empty}</p>
      )}
    </div>
  )
}

function isWithinDays(date: Date, days: number) {
  return Date.now() - date.getTime() <= days * 24 * 60 * 60 * 1000
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date)
}
