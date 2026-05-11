import type { ReactNode } from "react"

import { DashboardSidebar } from "@/components/dashboard/sidebar"

type DashboardShellProps = {
  children: ReactNode
  companies: Array<{ id: string; name: string }>
  activeCompany: { id: string; name: string } | null
  activePath:
    | "overview"
    | "brief"
    | "agents"
    | "projects"
    | "notes"
    | "docs"
    | "audit-logs"
    | "settings"
  username: string
}

export function DashboardShell(props: DashboardShellProps) {
  return (
    <div className="grid min-h-svh bg-background md:grid-cols-[18rem_1fr]">
      <DashboardSidebar
        companies={props.companies}
        activeCompany={props.activeCompany}
        activePath={props.activePath}
        username={props.username}
      />
      <main className="min-w-0 p-6 md:p-8">{props.children}</main>
    </div>
  )
}
