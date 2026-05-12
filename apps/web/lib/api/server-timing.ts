const MAX_SERVER_TIMING_DESCRIPTION_LENGTH = 80

export type ServerTimingMetric = {
  name: string
  startedAt: number
  description?: string
}

export function startServerTiming(name: string, description?: string) {
  return {
    name,
    description,
    startedAt: performance.now(),
  } satisfies ServerTimingMetric
}

export function formatServerTimingMetric(metric: ServerTimingMetric) {
  const duration = Math.max(0, performance.now() - metric.startedAt)
  const description = metric.description
    ? `;desc="${escapeServerTimingDescription(metric.description)}"`
    : ""

  return `${sanitizeServerTimingName(metric.name)}${description};dur=${duration.toFixed(1)}`
}

export function appendServerTiming(
  headers: Headers,
  metrics: Array<ServerTimingMetric | string>
) {
  const values = metrics.map((metric) =>
    typeof metric === "string" ? metric : formatServerTimingMetric(metric)
  )
  const currentValue = headers.get("Server-Timing")

  headers.set(
    "Server-Timing",
    currentValue ? `${currentValue}, ${values.join(", ")}` : values.join(", ")
  )
}

function sanitizeServerTimingName(name: string) {
  return name.replace(/[^!#$%&'*+.^_`|~0-9a-z-]/gi, "-")
}

function escapeServerTimingDescription(description: string) {
  return description
    .replace(/["\\]/g, "")
    .slice(0, MAX_SERVER_TIMING_DESCRIPTION_LENGTH)
}
