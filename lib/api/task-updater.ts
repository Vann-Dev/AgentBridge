type TaskUpdater = {
  taskUpdatedAt: Date
  taskUpdatedById?: string | null
  taskUpdatedByName?: string | null
  taskUpdatedByType: string
}

type AgentUpdaterInput = {
  id: string
  AgentId: string
  name: string
}

type UserUpdaterInput = {
  id: string
  name: string
}

export function agentTaskUpdater(agent: AgentUpdaterInput): TaskUpdater {
  return {
    taskUpdatedAt: new Date(),
    taskUpdatedById: agent.id,
    taskUpdatedByName: agent.name || agent.AgentId,
    taskUpdatedByType: "agent",
  }
}

export function userTaskUpdater(user: UserUpdaterInput): TaskUpdater {
  return {
    taskUpdatedAt: new Date(),
    taskUpdatedById: user.id,
    taskUpdatedByName: user.name,
    taskUpdatedByType: "user",
  }
}
