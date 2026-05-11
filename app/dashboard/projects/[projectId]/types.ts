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
  readMarkers: TaskReadMarker[]
  blockingReason: string | null
  assigned: {
    id: string
    name: string
    position: string
  }
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
