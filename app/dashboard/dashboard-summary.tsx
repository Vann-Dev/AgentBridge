"use client"

import { useQuery } from "@tanstack/react-query"

import { Button } from "@/components/ui/button"
import { apiJson } from "@/lib/api/client"

type DashboardSummary = {
  agents: number
  projects: number
  tasks: Partial<Record<"todo" | "inprogress" | "blocked" | "done", number>>
}

type DashboardSummaryProps = {
  companyId: string | null
  companyCount: number
}

export function DashboardSummary({ companyId, companyCount }: DashboardSummaryProps) {
  const summaryQuery = useQuery({
    queryKey: ["dashboard-summary", companyId],
    queryFn: () =>
      apiJson<{ summary: DashboardSummary }>(
        `/api/internal/dashboard/summary?companyId=${companyId}`
      ),
    enabled: Boolean(companyId),
  })

  if (!companyId) {
    return (
      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard label="Companies" value={companyCount} />
        <MetricCard label="Agents" value="-" />
        <MetricCard label="Projects" value="-" />
      </div>
    )
  }

  if (summaryQuery.isError) {
    return (
      <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
        <p>{summaryQuery.error.message}</p>
        <Button className="mt-3" size="sm" variant="outline" onClick={() => summaryQuery.refetch()}>
          Retry
        </Button>
      </div>
    )
  }

  const summary = summaryQuery.data?.summary
  const activeTasks = (summary?.tasks.inprogress ?? 0) + (summary?.tasks.blocked ?? 0)

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <MetricCard label="Companies" value={companyCount} />
      <MetricCard label="Agents" value={summary?.agents ?? "-"} loading={summaryQuery.isLoading} />
      <MetricCard
        label="Projects"
        value={summary?.projects ?? "-"}
        helper={summary ? `${activeTasks} active or blocked tasks` : undefined}
        loading={summaryQuery.isLoading}
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
