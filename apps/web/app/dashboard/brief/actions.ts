"use server"

import { Status } from "@/generated/prisma/enums"
import {
  cacheJson,
  cacheKey,
  cacheTtl,
  getCompanyCacheVersion,
  getProjectCacheVersion,
} from "@/lib/api/cache"
import { getSession } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

const briefRanges = ["today", "7d"] as const
const sectionLimit = 10

type BriefRangeKey = (typeof briefRanges)[number]

type ActionResult<T> = ({ ok: true } & T) | { ok: false; error: string }

export async function getBriefAction({
  companyId,
  projectId,
  range,
}: {
  companyId: string
  projectId?: string | null
  range: string
}): Promise<ActionResult<{ brief: BriefData }>> {
  const session = await getSession()

  if (!session) {
    return { ok: false, error: "Unauthorized" }
  }

  const rangeParam = range || "today"

  if (!companyId) {
    return { ok: false, error: "Company is required." }
  }

  if (!isBriefRange(rangeParam)) {
    return { ok: false, error: "Range must be today or 7d." }
  }

  const company = await prisma.company.findFirst({
    where: { id: companyId, userId: session.userId },
    select: { id: true },
  })

  if (!company) {
    return { ok: false, error: "Company not found." }
  }

  const projectFilter = projectId
    ? await prisma.project.findFirst({
        where: { id: projectId, companyId: company.id },
        select: { id: true, name: true },
      })
    : null

  if (projectId && !projectFilter) {
    return { ok: false, error: "Project not found." }
  }

  const companyVersion = await getCompanyCacheVersion(company.id)
  const projectVersion = projectId
    ? await getProjectCacheVersion(projectId)
    : "none"
  const { value } = await cacheJson(
    cacheKey([
      "internal",
      "dashboard-brief",
      session.userId,
      company.id,
      projectId,
      rangeParam,
      companyVersion,
      projectVersion,
    ]),
    cacheTtl.dashboardBrief,
    async () => {
      const now = new Date()
      const since = getRangeStart(rangeParam, now)
      const projectWhere = projectId
    ? { id: projectId, companyId: company.id }
    : { companyId: company.id }
      const taskWhere = {
    archivedAt: null,
    project: projectWhere,
  }
      const projectTaskIds = projectId
    ? await prisma.task.findMany({
        where: {
          projectId,
          project: { companyId: company.id },
        },
        select: { id: true },
      })
    : []
      const auditLogWhere = projectId
    ? {
        companyId: company.id,
        createdAt: { gte: since },
        OR: [
          { targetType: "project", targetId: projectId },
          {
            targetType: "task",
            targetId: { in: projectTaskIds.map((task) => task.id) },
          },
        ],
      }
    : {
        companyId: company.id,
        createdAt: { gte: since },
      }
      const taskSelect = {
    id: true,
    name: true,
    status: true,
    note: true,
    summaryUpdatedAt: true,
    blockingReason: true,
    taskUpdatedAt: true,
    taskUpdatedByName: true,
    taskUpdatedByType: true,
    assigned: {
      select: {
        id: true,
        name: true,
      },
    },
    project: {
      select: {
        id: true,
        name: true,
      },
    },
  }

      const [
    projects,
    changedTasks,
    blockedTasks,
    completedTasks,
    latestNotes,
    auditLogs,
      ] = await Promise.all([
    prisma.project.findMany({
      where: { companyId: company.id },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.task.findMany({
      where: {
        ...taskWhere,
        taskUpdatedAt: { gte: since },
      },
      orderBy: { taskUpdatedAt: "desc" },
      take: 50,
      select: taskSelect,
    }),
    prisma.task.findMany({
      where: {
        ...taskWhere,
        status: Status.blocked,
      },
      orderBy: { taskUpdatedAt: "desc" },
      take: sectionLimit,
      select: taskSelect,
    }),
    prisma.task.findMany({
      where: {
        ...taskWhere,
        status: Status.done,
        OR: [
          { taskUpdatedAt: { gte: since } },
          { summaryUpdatedAt: { gte: since } },
        ],
      },
      orderBy: [{ summaryUpdatedAt: "desc" }, { taskUpdatedAt: "desc" }],
      take: sectionLimit,
      select: taskSelect,
    }),
    prisma.task.findMany({
      where: {
        ...taskWhere,
        note: { not: null },
        OR: [
          { summaryUpdatedAt: { gte: since } },
          { taskUpdatedAt: { gte: since } },
        ],
      },
      orderBy: [{ summaryUpdatedAt: "desc" }, { taskUpdatedAt: "desc" }],
      take: sectionLimit,
      select: taskSelect,
    }),
    prisma.auditLog.findMany({
      where: auditLogWhere,
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        action: true,
        targetType: true,
        targetId: true,
        targetName: true,
        details: true,
        actorType: true,
        actorName: true,
        createdAt: true,
      },
    }),
  ])

      const readyForReview = latestNotes
    .filter((task) => task.status === Status.done && task.note?.trim())
    .slice(0, sectionLimit)
    .map((task) => ({
      ...serializeTask(task),
      reason: getReviewReason(task.name, task.note ?? ""),
    }))
      const brief = {
    range: {
      key: rangeParam,
      label: rangeParam === "today" ? "Last 24 hours" : "Last 7 days",
      since: since.toISOString(),
      until: now.toISOString(),
    },
    project: projectFilter,
    projects,
    counts: {
      changed: changedTasks.length + auditLogs.length,
      completed: completedTasks.length,
      blockers: blockedTasks.length,
      notes: latestNotes.length,
      readyForReview: readyForReview.length,
    },
    recentActivity: [
      ...auditLogs.map((log) => ({
        id: log.id,
        kind: log.action,
        title: formatAction(log.action, log.targetName),
        subtitle: log.details,
        actorName: log.actorName ?? fallbackActorLabel(log.actorType),
        actorType: log.actorType,
        occurredAt: log.createdAt.toISOString(),
        href: getAuditHref({
          targetType: log.targetType,
          targetId: log.targetId,
          companyId: company.id,
          projectId: projectId ?? null,
        }),
      })),
      ...changedTasks.map((task) => ({
        id: `task-${task.id}`,
        kind: `task.${task.status}`,
        title: task.name,
        subtitle: `${task.project.name} • ${task.status}`,
        actorName:
          task.taskUpdatedByName ?? fallbackActorLabel(task.taskUpdatedByType),
        actorType: task.taskUpdatedByType,
        occurredAt: task.taskUpdatedAt.toISOString(),
        href: taskHref(task.project.id, task.id, company.id),
      })),
    ]
      .sort(
        (left, right) =>
          new Date(right.occurredAt).getTime() -
          new Date(left.occurredAt).getTime()
      )
      .slice(0, sectionLimit),
    completedTasks: completedTasks.map((task) =>
      serializeTask(task, company.id)
    ),
    blockers: blockedTasks.map((task) => serializeTask(task, company.id)),
    latestNotes: latestNotes.map((task) => serializeTask(task, company.id)),
    readyForReview,
    suggestedActions: getSuggestedActions({
      blockers: blockedTasks.length,
      readyForReview: readyForReview.length,
      changed: changedTasks.length + auditLogs.length,
      companyId: company.id,
    }),
  }

      return { brief }
    }
  )



  return { ok: true, brief: value.brief }
}

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
  range: { key: BriefRangeKey; label: string; since: string; until: string }
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

function isBriefRange(value: string): value is BriefRangeKey {
  return briefRanges.includes(value as BriefRangeKey)
}

function getRangeStart(range: BriefRangeKey, now: Date) {
  const start = new Date(now)
  start.setDate(start.getDate() - (range === "today" ? 1 : 7))

  return start
}

function serializeTask(
  task: {
    id: string
    name: string
    status: Status
    note: string | null
    summaryUpdatedAt: Date | null
    blockingReason: string | null
    taskUpdatedAt: Date
    assigned: { id: string; name: string }
    project: { id: string; name: string }
  },
  companyId?: string
) {
  return {
    id: task.id,
    name: task.name,
    status: task.status,
    summary: task.note,
    summaryUpdatedAt: task.summaryUpdatedAt?.toISOString() ?? null,
    blockingReason: task.blockingReason,
    taskUpdatedAt: task.taskUpdatedAt.toISOString(),
    assigned: task.assigned,
    project: task.project,
    href: taskHref(task.project.id, task.id, companyId),
  }
}

function taskHref(projectId: string, taskId: string, companyId?: string) {
  const search = companyId ? `?company=${companyId}` : ""

  return `/dashboard/projects/${projectId}${search}#task-${taskId}`
}

function getAuditHref({
  companyId,
  targetId,
  targetType,
  projectId,
}: {
  companyId: string
  projectId: string | null
  targetId: string | null
  targetType: string
}) {
  if (targetType === "project" && targetId) {
    return `/dashboard/projects/${targetId}?company=${companyId}`
  }

  if (targetType === "task" && targetId && projectId) {
    return taskHref(projectId, targetId, companyId)
  }

  return `/dashboard/audit-logs?company=${companyId}`
}

function formatAction(action: string, targetName: string | null) {
  const label = action
    .split(".")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")

  return targetName ? `${label}: ${targetName}` : label
}

function fallbackActorLabel(type: string) {
  if (type === "agent") return "Agent"
  if (type === "user") return "User"

  return "System"
}

function getReviewReason(name: string, note: string) {
  const text = `${name} ${note}`

  if (/merge/i.test(text)) return "Mentions merge"
  if (/review|qa/i.test(text)) return "Mentions review"

  return "Done with summary"
}

function getSuggestedActions({
  blockers,
  changed,
  companyId,
  readyForReview,
}: {
  blockers: number
  changed: number
  companyId: string
  readyForReview: number
}) {
  const actions: Array<{
    label: string
    reason: string
    href: string
    priority: "high" | "medium" | "low"
  }> = []

  if (blockers) {
    actions.push({
      label: "Resolve or reassign blockers",
      reason: `${blockers} blocked task${blockers === 1 ? "" : "s"} need attention.`,
      href: `/dashboard/projects?company=${companyId}`,
      priority: "high",
    })
  }

  if (readyForReview) {
    actions.push({
      label: "Review done summaries",
      reason: `${readyForReview} completed task${readyForReview === 1 ? "" : "s"} look ready for review.`,
      href: `/dashboard/notes?company=${companyId}`,
      priority: "medium",
    })
  }

  if (!changed) {
    actions.push({
      label: "Check active project boards",
      reason: "No tracked changes in this range.",
      href: `/dashboard/projects?company=${companyId}`,
      priority: "low",
    })
  }

  return actions.slice(0, 5)
}
