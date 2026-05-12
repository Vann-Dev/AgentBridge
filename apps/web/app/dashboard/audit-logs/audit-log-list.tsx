"use client"

import { useQuery } from "@tanstack/react-query"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { apiJson } from "@/lib/api/client"

type AuditLog = {
  id: string
  action: string
  targetType: string
  targetId: string | null
  targetName: string | null
  details: string | null
  actorType: string
  actorName: string | null
  createdAt: string | Date
}

type AuditLogListProps = {
  companyId: string
  initialAuditLogs: AuditLog[]
}

export function AuditLogList({ companyId, initialAuditLogs }: AuditLogListProps) {
  const auditLogQuery = useQuery({
    queryKey: ["audit-logs", companyId],
    queryFn: () =>
      apiJson<{ auditLogs: AuditLog[] }>(`/api/internal/audit-logs?companyId=${companyId}`),
    initialData: { auditLogs: initialAuditLogs },
  })
  const auditLogs = auditLogQuery.data.auditLogs

  if (auditLogQuery.isError) {
    return (
      <div className="rounded-3xl border border-destructive/30 bg-destructive/5 p-6 text-sm">
        <p className="font-medium text-destructive">Could not load audit logs.</p>
        <p className="mt-1 text-muted-foreground">
          {auditLogQuery.error.message || "Please try again."}
        </p>
        <Button className="mt-4" variant="outline" onClick={() => auditLogQuery.refetch()}>
          Retry
        </Button>
      </div>
    )
  }

  if (auditLogQuery.isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="h-24 animate-pulse rounded-3xl bg-muted" />
        ))}
      </div>
    )
  }

  if (auditLogs.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-border bg-muted/30 p-8 text-center">
        <p className="text-lg font-medium">No audit entries yet</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Project, task, and agent changes will appear here as your team works.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {auditLogs.map((entry) => (
        <article
          key={entry.id}
          className="rounded-3xl border border-border bg-background p-4 shadow-sm"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{formatAction(entry.action)}</Badge>
                <Badge variant="outline">{entry.targetType}</Badge>
              </div>
              <div>
                <h3 className="font-semibold">
                  {entry.targetName || entry.targetId || "Unknown target"}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {entry.details || "No additional details."}
                </p>
              </div>
            </div>
            <div className="text-right text-sm text-muted-foreground">
              <p>{formatDate(entry.createdAt)}</p>
              <p className="mt-1">
                {entry.actorName || "Unknown"} · {entry.actorType}
              </p>
            </div>
          </div>
        </article>
      ))}
    </div>
  )
}

function formatAction(action: string) {
  return action
    .split(".")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).replaceAll("_", " "))
    .join(" · ")
}

function formatDate(value: string | Date) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value))
}
