"use client"

import Link from "next/link"
import type { ComponentType, ReactNode } from "react"
import { useMemo, useState } from "react"
import {
  AlertCircleIcon,
  CheckCircle2Icon,
  ClockIcon,
  FileTextIcon,
} from "lucide-react"
import { useQuery } from "@tanstack/react-query"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { getBriefAction } from "./actions"

type BriefRange = "today" | "7d"
type BriefTask = {
  id: string
  name: string
  status: string
  summary: string | null
  summaryUpdatedAt: string | null
  blockingReason: string | null
  taskUpdatedAt: string
  assigned: { id: string; name: string }
  project: { id: string; name: string }
  href: string
}
type BriefActivity = {
  id: string
  kind: string
  title: string
  subtitle: string | null
  actorName: string
  actorType: string
  occurredAt: string
  href: string
}
type BriefData = {
  range: { key: BriefRange; label: string; since: string; until: string }
  project: { id: string; name: string } | null
  projects: Array<{ id: string; name: string }>
  counts: {
    changed: number
    completed: number
    blockers: number
    notes: number
    readyForReview: number
  }
  recentActivity: BriefActivity[]
  completedTasks: BriefTask[]
  blockers: BriefTask[]
  latestNotes: BriefTask[]
  readyForReview: Array<BriefTask & { reason: string }>
  suggestedActions: Array<{
    label: string
    reason: string
    href: string
    priority: "high" | "medium" | "low"
  }>
}

export function BriefClient({ companyId }: { companyId: string }) {
  const [range, setRange] = useState<BriefRange>("today")
  const [projectId, setProjectId] = useState("all")
  const query = useQuery({
    queryKey: ["dashboard-brief", companyId, range, projectId],
    queryFn: async () => {
      const result = await getBriefAction({
        companyId,
        range,
        projectId: projectId === "all" ? null : projectId,
      })

      if (!result.ok) {
        throw new Error(result.error)
      }

      return { brief: result.brief as BriefData }
    },
  })
  const brief = query.data?.brief
  const metricCards = useMemo(
    () => [
      {
        label: "Changed",
        value: brief?.counts.changed,
        icon: ClockIcon,
        href: "#what-changed",
      },
      {
        label: "Completed",
        value: brief?.counts.completed,
        icon: CheckCircle2Icon,
        href: "#completed",
      },
      {
        label: "Blocked",
        value: brief?.counts.blockers,
        icon: AlertCircleIcon,
        href: "#needs-attention",
      },
      {
        label: "Notes",
        value: brief?.counts.notes,
        icon: FileTextIcon,
        href: "#latest-notes",
      },
    ],
    [brief]
  )

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <CardTitle className="text-3xl">Brief</CardTitle>
              <CardDescription className="mt-2 max-w-2xl leading-6">
                What changed and what needs attention. This v1 digest is
                rule-based from task, note, and audit log activity.
              </CardDescription>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="flex rounded-2xl border border-border bg-muted p-1">
                <Button
                  type="button"
                  size="sm"
                  variant={range === "today" ? "default" : "ghost"}
                  onClick={() => setRange("today")}
                >
                  Today
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={range === "7d" ? "default" : "ghost"}
                  onClick={() => setRange("7d")}
                >
                  Last 7 days
                </Button>
              </div>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger className="w-full sm:w-56">
                  <SelectValue placeholder="All projects" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All projects</SelectItem>
                  {brief?.projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {brief ? (
            <p className="text-xs text-muted-foreground">
              Showing {brief.range.label.toLowerCase()} through{" "}
              {formatDateTime(brief.range.until)}.
            </p>
          ) : null}
        </CardHeader>
      </Card>

      {query.isError ? (
        <div className="flex flex-col gap-3 rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive sm:flex-row sm:items-center sm:justify-between">
          <p>{query.error.message}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => query.refetch()}
          >
            Retry
          </Button>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metricCards.map((metric) => (
          <MetricCard
            key={metric.label}
            href={metric.href}
            icon={metric.icon}
            label={metric.label}
            loading={query.isLoading}
            value={metric.value}
          />
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(22rem,0.9fr)]">
        <div className="space-y-6">
          <TaskSection
            id="needs-attention"
            title="Needs attention"
            description="Active blockers, newest first."
            empty="No blockers in this range."
            loading={query.isLoading}
            tasks={brief?.blockers}
            tone="danger"
            renderExtra={(task) =>
              task.blockingReason ? (
                <Preview text={task.blockingReason} />
              ) : null
            }
          />
          <ActivitySection
            loading={query.isLoading}
            items={brief?.recentActivity}
          />
          <TaskSection
            id="completed"
            title="Completed"
            description="Done cards changed or summarized in the selected range."
            empty="No completed tasks yet."
            loading={query.isLoading}
            tasks={brief?.completedTasks}
            renderExtra={(task) =>
              task.summary ? <Preview text={task.summary} /> : null
            }
          />
        </div>
        <div className="space-y-6">
          <TaskSection
            id="latest-notes"
            title="Latest agent notes"
            description="Recent non-empty task summaries and notes."
            empty="No new notes in this range."
            loading={query.isLoading}
            tasks={brief?.latestNotes}
            renderExtra={(task) =>
              task.summary ? <Preview text={task.summary} /> : null
            }
          />
          <ReviewSection
            loading={query.isLoading}
            items={brief?.readyForReview}
          />
          <ActionsSection
            loading={query.isLoading}
            actions={brief?.suggestedActions}
          />
        </div>
      </div>
    </div>
  )
}

function MetricCard({
  href,
  icon: Icon,
  label,
  loading,
  value,
}: {
  href: string
  icon: ComponentType<{ className?: string }>
  label: string
  loading: boolean
  value: number | undefined
}) {
  return (
    <a
      href={href}
      className="rounded-3xl border border-border bg-card p-5 transition hover:bg-muted/50"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{label}</p>
        <Icon className="size-4 text-muted-foreground" />
      </div>
      {loading ? (
        <div className="mt-3 h-8 w-16 animate-pulse rounded bg-muted" />
      ) : (
        <p className="mt-2 text-3xl font-semibold">{value ?? 0}</p>
      )}
    </a>
  )
}

function TaskSection({
  description,
  empty,
  id,
  loading,
  renderExtra,
  tasks,
  title,
  tone,
}: {
  description: string
  empty: string
  id: string
  loading: boolean
  renderExtra?: (task: BriefTask) => ReactNode
  tasks: BriefTask[] | undefined
  title: string
  tone?: "danger"
}) {
  return (
    <SectionCard id={id} title={title} description={description}>
      {loading ? <SectionSkeleton /> : null}
      {!loading && !tasks?.length ? <EmptyState>{empty}</EmptyState> : null}
      <div className="space-y-3">
        {tasks?.map((task) => (
          <Link
            key={task.id}
            href={task.href}
            className="block rounded-2xl border border-border bg-background p-4 transition hover:bg-muted/60"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-medium">{task.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {task.project.name} • {task.assigned.name} •{" "}
                  {formatRelativeTime(task.taskUpdatedAt)}
                </p>
              </div>
              <Badge variant={tone === "danger" ? "destructive" : "outline"}>
                {task.status}
              </Badge>
            </div>
            {renderExtra?.(task)}
          </Link>
        ))}
      </div>
    </SectionCard>
  )
}

function ActivitySection({
  loading,
  items,
}: {
  loading: boolean
  items: BriefActivity[] | undefined
}) {
  return (
    <SectionCard
      id="what-changed"
      title="What changed"
      description="Tracked audit and task activity."
    >
      {loading ? <SectionSkeleton /> : null}
      {!loading && !items?.length ? (
        <EmptyState>No tracked changes for this range.</EmptyState>
      ) : null}
      <div className="space-y-3">
        {items?.map((item) => (
          <Link
            key={item.id}
            href={item.href}
            className="block rounded-2xl border border-border bg-background p-4 transition hover:bg-muted/60"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-medium">{item.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {item.actorName} • {formatRelativeTime(item.occurredAt)}
                </p>
              </div>
              <Badge variant="secondary">{item.kind}</Badge>
            </div>
            {item.subtitle ? <Preview text={item.subtitle} /> : null}
          </Link>
        ))}
      </div>
    </SectionCard>
  )
}

function ReviewSection({
  items,
  loading,
}: {
  items: Array<BriefTask & { reason: string }> | undefined
  loading: boolean
}) {
  return (
    <SectionCard
      title="Likely ready for review"
      description="Heuristic only: done cards with summaries."
    >
      {loading ? <SectionSkeleton /> : null}
      {!loading && !items?.length ? (
        <EmptyState>Nothing obvious is ready for review.</EmptyState>
      ) : null}
      <div className="space-y-3">
        {items?.map((item) => (
          <Link
            key={item.id}
            href={item.href}
            className="block rounded-2xl border border-border bg-background p-4 transition hover:bg-muted/60"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-medium">{item.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {item.project.name}
                </p>
              </div>
              <Badge variant="secondary">{item.reason}</Badge>
            </div>
          </Link>
        ))}
      </div>
    </SectionCard>
  )
}

function ActionsSection({
  actions,
  loading,
}: {
  actions: BriefData["suggestedActions"] | undefined
  loading: boolean
}) {
  return (
    <SectionCard
      title="Suggested next actions"
      description="Deterministic prompts based on this brief."
    >
      {loading ? <SectionSkeleton /> : null}
      {!loading && !actions?.length ? (
        <EmptyState>No suggested actions right now.</EmptyState>
      ) : null}
      <div className="space-y-3">
        {actions?.map((action) => (
          <Link
            key={action.label}
            href={action.href}
            className="block rounded-2xl border border-border bg-background p-4 transition hover:bg-muted/60"
          >
            <div className="flex items-start justify-between gap-3">
              <p className="font-medium">{action.label}</p>
              <Badge
                variant={action.priority === "high" ? "destructive" : "outline"}
              >
                {action.priority}
              </Badge>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {action.reason}
            </p>
          </Link>
        ))}
      </div>
    </SectionCard>
  )
}

function SectionCard({
  children,
  description,
  id,
  title,
}: {
  children: ReactNode
  description: string
  id?: string
  title: string
}) {
  return (
    <Card id={id} className="scroll-mt-6">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

function Preview({ text }: { text: string }) {
  return (
    <p className="mt-3 line-clamp-3 text-sm whitespace-pre-wrap text-muted-foreground">
      {text}
    </p>
  )
}

function EmptyState({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-2xl bg-muted p-4 text-sm text-muted-foreground">
      {children}
    </p>
  )
}

function SectionSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }, (_, index) => (
        <div
          key={index}
          className="space-y-3 rounded-2xl border border-border p-4"
        >
          <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
          <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
          <div className="h-12 animate-pulse rounded bg-muted" />
        </div>
      ))}
    </div>
  )
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value))
}

function formatRelativeTime(value: string) {
  const date = new Date(value)
  const diffSeconds = Math.round((date.getTime() - Date.now()) / 1000)
  const absSeconds = Math.abs(diffSeconds)
  const units = [
    { unit: "year", seconds: 31536000 },
    { unit: "month", seconds: 2592000 },
    { unit: "week", seconds: 604800 },
    { unit: "day", seconds: 86400 },
    { unit: "hour", seconds: 3600 },
    { unit: "minute", seconds: 60 },
  ] as const
  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" })

  for (const { unit, seconds } of units) {
    if (absSeconds >= seconds) {
      return formatter.format(Math.round(diffSeconds / seconds), unit)
    }
  }

  return formatter.format(diffSeconds, "second")
}
