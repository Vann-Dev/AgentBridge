import { Status } from "@/generated/prisma/enums"

export type TaskFreshnessInput = {
  currentStatus: Status
  currentNote: string | null
  nextStatus?: Status
  nextNote?: string | null
  hasReadBy: boolean
  now?: Date
}

export type TaskFreshnessResult = {
  nextStatus: Status
  noteChanged: boolean
  statusChanged: boolean
  shouldClearNextStatusReads: boolean
  summaryUpdatedAt?: Date | null
}

export function getTaskFreshnessUpdate({
  currentStatus,
  currentNote,
  nextStatus,
  nextNote,
  hasReadBy,
  now = new Date(),
}: TaskFreshnessInput): TaskFreshnessResult {
  const resultingStatus = nextStatus ?? currentStatus
  const statusChanged = resultingStatus !== currentStatus
  const noteChanged = nextNote !== undefined && nextNote !== currentNote

  return {
    nextStatus: resultingStatus,
    noteChanged,
    statusChanged,
    shouldClearNextStatusReads: !hasReadBy && (statusChanged || noteChanged),
    ...(noteChanged ? { summaryUpdatedAt: nextNote ? now : null } : {}),
  }
}

export function parseReadByAgentIds(value: unknown) {
  if (value === undefined) return []
  if (!Array.isArray(value)) return null

  const agentIds = value.filter((item): item is string => typeof item === "string" && Boolean(item))

  return agentIds.length === value.length ? Array.from(new Set(agentIds)) : null
}
