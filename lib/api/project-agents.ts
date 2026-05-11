export const projectAgentSelect = {
  agent: {
    select: {
      id: true,
      AgentId: true,
      name: true,
      position: true,
    },
  },
} as const

export function serializeProjectAgents<
  T extends { agent: { id: string; AgentId: string; name: string; position: string } },
>(projectAgents: T[]) {
  return projectAgents.map(({ agent }) => agent)
}
