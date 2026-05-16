export function isDoneSummaryUnread({
  readAt,
  summaryUpdatedAt,
}: {
  readAt?: Date | null
  summaryUpdatedAt?: Date | null
}) {
  return !readAt || !summaryUpdatedAt || readAt < summaryUpdatedAt
}
