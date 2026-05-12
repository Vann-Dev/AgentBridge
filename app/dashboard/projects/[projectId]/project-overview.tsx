"use client"

import { useMemo } from "react"
import { AlertCircle, CheckCircle2, Circle, Clock3, UsersRound } from "lucide-react"

import { Status } from "@/generated/prisma/enums"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { cn } from "@/lib/utils"

import type { ProjectDetailData, ProjectTask } from "./types"

type ProjectOverviewProps = {
  project: ProjectDetailData
}

const statuses = [
  {
    key: Status.todo,
    label: "Todo",
    helper: "Ready for someone to pick up",
    icon: Circle,
  },
  {
    key: Status.inprogress,
    label: "In progress",
    helper: "Actively being worked on",
    icon: Clock3,
  },
  {
    key: Status.blocked,
    label: "Blocked",
    helper: "Needs unblock or decision",
    icon: AlertCircle,
  },
  {
    key: Status.done,
    label: "Done",
    helper: "Completed and ready to review",
    icon: CheckCircle2,
  },
] as const

const statusLabels = new Map(statuses.map((status) => [status.key, status.label]))
const reviewReaderAgentId = "main"

export function ProjectOverview({ project }: ProjectOverviewProps) {
  const tasks = project.tasks
  const totalTasks = tasks.length
  const doneTasks = tasks.filter((task) => task.status === Status.done)
  const blockedTasks = tasks.filter((task) => task.status === Status.blocked)
  const attentionTasks = tasks.filter((task) => {
    if (task.status === Status.done) return false

    return (
      task.status === Status.blocked ||
      task.isDependencyReady ||
      /qa|fix|review|blocked|failure/i.test(`${task.name} ${task.blockingReason ?? ""}`)
    )
  })
  const activeTasks = tasks.filter((task) => task.status === Status.inprogress)
  const todoTasks = tasks.filter((task) => task.status === Status.todo)
  const donePercent = totalTasks ? Math.round((doneTasks.length / totalTasks) * 100) : 0
  const statusCounts = new Map(statuses.map((status) => [status.key, 0]))

  for (const task of tasks) {
    statusCounts.set(task.status, (statusCounts.get(task.status) ?? 0) + 1)
  }

  const agentSummaries = useMemo(() => {
    const byAgent = new Map<
      string,
      {
        id: string
        name: string
        position: string
        total: number
        inprogress: number
        blocked: number
        todo: number
        done: number
        current: ProjectTask[]
        latestDone: ProjectTask | null
      }
    >()

    for (const task of tasks) {
      const summary =
        byAgent.get(task.assigned.id) ??
        {
          id: task.assigned.id,
          name: task.assigned.name,
          position: task.assigned.position,
          total: 0,
          inprogress: 0,
          blocked: 0,
          todo: 0,
          done: 0,
          current: [],
          latestDone: null,
        }

      summary.total += 1
      summary[task.status] += 1

      if (task.status === Status.inprogress || task.status === Status.blocked) {
        summary.current.push(task)
      }

      if (task.status === Status.done && task.summaryUpdatedAt && !summary.latestDone) {
        summary.latestDone = task
      }

      byAgent.set(task.assigned.id, summary)
    }

    return Array.from(byAgent.values()).sort((left, right) => {
      const priority = right.inprogress - left.inprogress || right.blocked - left.blocked

      return priority || left.name.localeCompare(right.name)
    })
  }, [tasks])

  const recentDone = doneTasks.filter(isUnreadDoneSummary).slice(0, 5)
  const upcomingTasks = todoTasks.slice(0, 5)

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Total tasks" value={totalTasks} helper="All project work" />
        <MetricCard label="In progress" value={activeTasks.length} helper="Currently active" />
        <MetricCard label="Blocked" value={blockedTasks.length} helper="Needs attention" danger={blockedTasks.length > 0} />
        <MetricCard label="Complete" value={`${donePercent}%`} helper={`${doneTasks.length} done`} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Project progress</CardTitle>
          <CardDescription>
            Status distribution and completion health for this project.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="h-3 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${donePercent}%` }}
            />
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {statuses.map((status) => {
              const Icon = status.icon
              const count = statusCounts.get(status.key) ?? 0

              return (
                <div key={status.key} className="rounded-2xl border bg-background p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Icon className="size-4 text-muted-foreground" />
                      <p className="font-medium">{status.label}</p>
                    </div>
                    <Badge variant="outline">{count}</Badge>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">
                    {status.helper}
                  </p>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <UsersRound className="size-5 text-muted-foreground" />
              <CardTitle className="text-2xl">Who is working</CardTitle>
            </div>
            <CardDescription>
              Assigned agents, workload by status, and current active work.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {agentSummaries.length ? (
              agentSummaries.map((agent) => (
                <div key={agent.id} className="rounded-2xl border bg-background p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-medium">{agent.name}</p>
                      <p className="text-sm text-muted-foreground">{agent.position}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="secondary">{agent.total} total</Badge>
                      <Badge variant="outline">{agent.inprogress} active</Badge>
                      {agent.blocked ? <Badge variant="destructive">{agent.blocked} blocked</Badge> : null}
                    </div>
                  </div>
                  <div className="mt-4 grid gap-2 text-sm md:grid-cols-4">
                    <StatusCount label="Todo" value={agent.todo} />
                    <StatusCount label="In progress" value={agent.inprogress} />
                    <StatusCount label="Blocked" value={agent.blocked} />
                    <StatusCount label="Done" value={agent.done} />
                  </div>
                  {agent.current.length ? (
                    <div className="mt-4 space-y-2">
                      {agent.current.slice(0, 3).map((task) => (
                        <TaskSummary key={task.id} task={task} />
                      ))}
                    </div>
                  ) : agent.latestDone ? (
                    <div className="mt-4 rounded-2xl bg-muted p-3 text-sm">
                      <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                        Latest result note
                      </p>
                      <p className="mt-1 font-medium">{agent.latestDone.name}</p>
                      <p className="mt-1 text-muted-foreground">
                        Summary updated {formatRelativeTime(new Date(agent.latestDone.summaryUpdatedAt ?? agent.latestDone.taskUpdatedAt))}
                      </p>
                    </div>
                  ) : null}
                </div>
              ))
            ) : (
              <EmptyMessage title="No assigned work yet" text="Create tasks to see agent workload and active work here." />
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Attention queue</CardTitle>
              <CardDescription>Blocked, dependency-ready, QA, and fix-needed tasks.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {attentionTasks.length ? (
                attentionTasks.slice(0, 6).map((task) => <TaskSummary key={task.id} task={task} />)
              ) : (
                <EmptyMessage title="No attention items" text="No blockers, ready dependency work, or obvious QA/fix tasks." />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recently completed</CardTitle>
              <CardDescription>Unread done summaries for the review reader.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {recentDone.length ? (
                recentDone.map((task) => <TaskSummary key={task.id} task={task} />)
              ) : (
                <EmptyMessage title="No unread summaries" text="New done summaries appear here until the review reader marks them reviewed." />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Up next</CardTitle>
              <CardDescription>Todo work waiting to start.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {upcomingTasks.length ? (
                upcomingTasks.map((task) => <TaskSummary key={task.id} task={task} />)
              ) : (
                <EmptyMessage title="No todo tasks" text="The backlog is empty for this project." />
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

export function ProjectOverviewSkeleton() {
  return (
    <div className="space-y-6" aria-label="Loading project overview">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <SkeletonBlock key={index} className="h-32" />
        ))}
      </div>
      <SkeletonBlock className="h-56" />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
        <SkeletonBlock className="h-96" />
        <div className="space-y-6">
          <SkeletonBlock className="h-44" />
          <SkeletonBlock className="h-44" />
          <SkeletonBlock className="h-44" />
        </div>
      </div>
    </div>
  )
}

function MetricCard({
  danger,
  helper,
  label,
  value,
}: {
  danger?: boolean
  helper: string
  label: string
  value: number | string
}) {
  return (
    <Card className={cn(danger && "border-destructive/40 bg-destructive/10")}>
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-3xl">{value}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className={cn("text-sm text-muted-foreground", danger && "text-destructive")}>{helper}</p>
      </CardContent>
    </Card>
  )
}

function StatusCount({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-muted px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
    </div>
  )
}

function isUnreadDoneSummary(task: ProjectTask) {
  if (!task.summaryUpdatedAt) return false

  const readMarker =
    task.readMarkers.find(
      (marker) => marker.status === Status.done && marker.agent.AgentId === reviewReaderAgentId
    ) ?? task.readMarkers.find((marker) => marker.status === Status.done)

  return !readMarker || new Date(readMarker.readAt) < new Date(task.summaryUpdatedAt)
}

function TaskSummary({ task }: { task: ProjectTask }) {
  return (
    <div className="rounded-2xl bg-muted p-3 text-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-medium">{task.name}</p>
          <p className="text-xs text-muted-foreground">
            {task.assigned.name} · {statusLabels.get(task.status)}
          </p>
          <TaskUpdateMeta task={task} />
        </div>
        <Badge variant={task.status === Status.blocked ? "destructive" : "outline"}>
          {statusLabels.get(task.status)}
        </Badge>
      </div>
      {task.dependencies.length ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Depends on {task.dependencies.length} task{task.dependencies.length === 1 ? "" : "s"}
          {task.isDependencyReady ? " · ready" : ""}
        </p>
      ) : null}
      {task.blockingReason ? (
        <p className="mt-2 line-clamp-3 text-destructive">{task.blockingReason}</p>
      ) : task.summaryUpdatedAt ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Summary updated {formatRelativeTime(new Date(task.summaryUpdatedAt))}
        </p>
      ) : null}
    </div>
  )
}

function TaskUpdateMeta({ task }: { task: ProjectTask }) {
  const updatedAt = new Date(task.taskUpdatedAt)

  if (Number.isNaN(updatedAt.getTime())) return null

  const actor = task.taskUpdatedByName?.trim() || fallbackUpdaterLabel(task.taskUpdatedByType)
  const exact = new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(updatedAt)

  return (
    <p className="mt-0.5 text-xs text-muted-foreground" title={`Updated ${exact}${actor ? ` by ${actor}` : ""}`}>
      Updated {formatRelativeTime(updatedAt)}{actor ? ` by ${actor}` : ""}
    </p>
  )
}

function fallbackUpdaterLabel(type: string) {
  if (type === "agent") return "agent"
  if (type === "user") return "user"

  return "system"
}

function formatRelativeTime(date: Date) {
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

function EmptyMessage({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-dashed bg-background p-4 text-sm">
      <p className="font-medium">{title}</p>
      <p className="mt-1 text-muted-foreground">{text}</p>
    </div>
  )
}

function SkeletonBlock({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-3xl bg-muted", className)} />
}
