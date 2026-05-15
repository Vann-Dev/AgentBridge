import { Status } from "@/generated/prisma/enums"

const statuses = Object.values(Status)

export type AgentTaskPatchInput = {
  assignedAgentId?: unknown
  name?: unknown
  job?: unknown
  status?: unknown
  note?: unknown
  readBy?: unknown
  blockingReason?: unknown
}

export type AgentTaskPatchData = {
  assignedAgentId?: string
  name?: string
  job?: string
  status?: Status
  note?: string | null
  summaryUpdatedAt?: Date | null
  blockingReason?: string | null
}

type AgentTaskPatchValidationResult =
  | { ok: true; data: AgentTaskPatchData; readBy: string[] | null; hasReadBy: boolean }
  | { ok: false; error: string }

export function validateAgentTaskPatchInput(
  updates: AgentTaskPatchInput
): AgentTaskPatchValidationResult {
  const data: AgentTaskPatchData = {}
  const readBy = parseReadByAgentIds(updates.readBy)
  const hasReadBy = updates.readBy !== undefined

  if (hasReadBy && !readBy) return { ok: false, error: "Invalid read markers" }

  if (updates.assignedAgentId !== undefined) {
    if (typeof updates.assignedAgentId !== "string" || !updates.assignedAgentId) {
      return { ok: false, error: "Invalid assigned agent" }
    }

    data.assignedAgentId = updates.assignedAgentId
  }

  if (updates.name !== undefined) {
    if (typeof updates.name !== "string" || !updates.name.trim()) {
      return { ok: false, error: "Task name is required" }
    }

    data.name = updates.name.trim()
  }

  if (updates.job !== undefined) {
    if (typeof updates.job !== "string" || !updates.job.trim()) {
      return { ok: false, error: "Task job is required" }
    }

    data.job = updates.job.trim()
  }

  if (updates.status !== undefined) {
    if (typeof updates.status !== "string" || !statuses.includes(updates.status as Status)) {
      return { ok: false, error: "Invalid task status" }
    }

    data.status = updates.status as Status
  }

  if (updates.note !== undefined) {
    if (updates.note !== null && typeof updates.note !== "string") {
      return { ok: false, error: "Invalid task note" }
    }

    data.note = updates.note?.trim() || null
  }

  if (updates.blockingReason !== undefined) {
    if (updates.blockingReason !== null && typeof updates.blockingReason !== "string") {
      return { ok: false, error: "Invalid blocking reason" }
    }

    data.blockingReason = updates.blockingReason?.trim() || null
  }

  if (!Object.keys(data).length && !hasReadBy) {
    return { ok: false, error: "No task updates provided" }
  }

  return { ok: true, data, readBy, hasReadBy }
}

export function parseReadByAgentIds(value: unknown) {
  if (value === undefined) return []
  if (!Array.isArray(value)) return null
  const agentIds = value.filter((item): item is string => typeof item === "string" && Boolean(item))
  return agentIds.length === value.length ? Array.from(new Set(agentIds)) : null
}
