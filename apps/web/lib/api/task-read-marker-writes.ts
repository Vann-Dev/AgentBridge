import { Status } from "@/generated/prisma/enums"

type ReadMarkerAgent = {
  id: string
}

export function createTaskReadMarkerRows({
  taskId,
  readAgents,
  status,
}: {
  taskId: string
  readAgents: ReadMarkerAgent[]
  status: Status
}) {
  return readAgents.map((readAgent) => ({
    taskId,
    agentId: readAgent.id,
    status,
  }))
}
