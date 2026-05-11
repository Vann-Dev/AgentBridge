import type { Status } from "@/generated/prisma/enums"

export type TaskReadMarker = {
  agentId: string
  status: Status
  readAt: string | Date
  agent: {
    id: string
    AgentId: string
    name: string
  }
}

export type ProjectTask = {
  id: string
  name: string
  job: string
  status: Status
  note: string | null
  summaryUpdatedAt: string | Date | null
  readMarkers: TaskReadMarker[]
  blockingReason: string | null
  dependencies: TaskDependency[]
  dependencyIds: string[]
  unblocks: TaskDependency[]
  isDependencyReady: boolean
  assigned: {
    id: string
    name: string
    position: string
  }
}

export type TaskDependency = {
  id: string
  name: string
  status: Status
}

export type ProjectAgent = {
  id: string
  name: string
  position: string
}

export type ProjectDetailData = {
  id: string
  companyId: string
  name: string
  description: string
  company: {
    id: string
    name: string
    agents: ProjectAgent[]
  }
  tasks: ProjectTask[]
}
