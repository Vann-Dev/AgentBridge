import { serializeTaskDependencies, type TaskDependencyPayload } from "@/lib/api/task-dependencies"
import { Status } from "@/generated/prisma/enums"

type ReadMarker = {
  status: Status
  readAt: Date
  agent: {
    AgentId: string
  }
}

export function serializeTaskReadMarkers<
  T extends { status: Status; readMarkers: ReadMarker[] } & Partial<TaskDependencyPayload>,
>(task: T) {
  const { readMarkers, ...rest } = task

  return {
    ...serializeTaskDependencies(rest),
    readBy: readMarkers
      .filter((marker) => marker.status === task.status)
      .map((marker) => marker.agent.AgentId),
  }
}
