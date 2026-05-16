import { prisma } from "@/lib/prisma"

const defaultReviewReaderAgentId = "main"

export type ReviewReader = {
  id: string
  AgentId: string
  name: string
}

export async function findReviewReader(companyId: string): Promise<ReviewReader | null> {
  return prisma.agent.findFirst({
    where: {
      companyId,
      AgentId: defaultReviewReaderAgentId,
    },
    select: {
      id: true,
      AgentId: true,
      name: true,
    },
  })
}

export function getReviewReaderLabel(reader: ReviewReader | null) {
  if (!reader) return "No review reader"

  return reader.AgentId === defaultReviewReaderAgentId
    ? "Natsuki/main"
    : `${reader.name} (${reader.AgentId})`
}
