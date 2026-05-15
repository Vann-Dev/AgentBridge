import { serializeTaskDependencies, type TaskDependencyPayload } from "@/lib/api/task-dependencies"
import { Status } from "@/generated/prisma/enums"

type TaskSummaryPayload = {
  note?: string | null
  summaryUpdatedAt?: Date | null
}

type ReadMarker = {
  status: Status
  readAt: Date
  agent: {
    AgentId: string
  }
}

export function serializeTaskReadMarkers<
  T extends { status: Status; readMarkers: ReadMarker[] } & Partial<TaskDependencyPayload> & TaskSummaryPayload,
>(task: T) {
  const { readMarkers, ...rest } = task
  const serializedTask = serializeTaskDependencies(rest)

  return {
    ...serializedTask,
    summaryUpdatedAt: getStoredSummaryUpdatedAt(serializedTask),
    readBy: readMarkers
      .filter((marker) => marker.status === task.status)
      .map((marker) => marker.agent.AgentId),
  }
}

export function getStoredSummaryUpdatedAt(task: TaskSummaryPayload) {
  return task.note ? (task.summaryUpdatedAt ?? null) : null
}
