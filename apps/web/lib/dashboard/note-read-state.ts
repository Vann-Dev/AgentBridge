import { Status } from "@/generated/prisma/enums"

const missingReviewReaderAgentId = "__no_review_reader__"

type DoneSummaryReviewReader = {
  id: string
} | null

export function isDoneSummaryUnread({
  readAt,
  summaryUpdatedAt,
}: {
  readAt?: Date | null
  summaryUpdatedAt?: Date | null
}) {
  return !readAt || !summaryUpdatedAt || readAt < summaryUpdatedAt
}

export function getDoneSummaryReviewReadMarkerWhere(
  reviewReader: DoneSummaryReviewReader
) {
  return {
    status: Status.done,
    ...(reviewReader
      ? { agentId: reviewReader.id }
      : { agentId: missingReviewReaderAgentId }),
  }
}
