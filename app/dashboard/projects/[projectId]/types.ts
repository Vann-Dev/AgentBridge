import type { Status } from "@/generated/prisma/enums"

export type ProjectTask = {
  id: string
  name: string
  job: string
  status: Status
  note: string | null
  natsukiReadAt: string | Date | null
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
