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
  status: Status
  summaryUpdatedAt: string | Date | null
  taskUpdatedAt: string | Date
  taskUpdatedById: string | null
  taskUpdatedByName: string | null
  taskUpdatedByType: string
  readCount: number
  readMarkers?: TaskReadMarker[]
  blockingReason: string | null
  blockingReasonPreview: string | null
  dependencies: TaskDependency[]
  dependencyIds: string[]
  dependencyCount: number
  unblocks: TaskDependency[]
  unblocksCount: number
  isDependencyReady: boolean
  isUnreadDoneSummary: boolean
  assigned: {
    id: string
    name: string
    position: string
  }
}

export type ProjectTaskDetail = ProjectTask & {
  job: string
  note: string | null
}

export type TaskDependency = {
  id: string
  name: string
  status: Status
}

export type ProjectAgent = {
  id: string
  AgentId: string
  name: string
  position: string
}

export type RequestDiagnostics = {
  label: string
  clientDurationMs: number
  serverTiming: string | null
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
  projectAgents: ProjectAgent[]
  tasks: ProjectTask[]
}
