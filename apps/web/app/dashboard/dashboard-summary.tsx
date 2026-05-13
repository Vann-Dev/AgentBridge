
type DashboardSummary = {
  agents: number
  projects: number
  tasks: Partial<Record<"todo" | "inprogress" | "blocked" | "done", number>>
}

type DashboardSummaryProps = {
  companyCount: number
  summary: DashboardSummary | null
}

export function DashboardSummary({ companyCount, summary }: DashboardSummaryProps) {
  if (!summary) {
    return (
      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard label="Companies" value={companyCount} />
        <MetricCard label="Agents" value="-" />
        <MetricCard label="Projects" value="-" />
      </div>
    )
  }

  const activeTasks = (summary.tasks.inprogress ?? 0) + (summary.tasks.blocked ?? 0)

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <MetricCard label="Companies" value={companyCount} />
      <MetricCard label="Agents" value={summary.agents} />
      <MetricCard
        label="Projects"
        value={summary.projects}
        helper={`${activeTasks} active or blocked tasks`}
      />
    </div>
  )
}

function MetricCard({
  helper,
  label,
  loading,
  value,
}: {
  helper?: string
  label: string
  loading?: boolean
  value: number | string
}) {
  return (
    <div className="rounded-3xl border border-border bg-card p-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      {loading ? (
        <div className="mt-3 h-8 w-16 animate-pulse rounded bg-muted" />
      ) : (
        <p className="mt-2 text-3xl font-semibold">{value}</p>
      )}
      {helper ? <p className="mt-2 text-xs text-muted-foreground">{helper}</p> : null}
    </div>
  )
}
