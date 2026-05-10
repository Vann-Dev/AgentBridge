import { redirect } from "next/navigation"

import { DashboardShell } from "@/components/dashboard/shell"
import { getDashboardContext } from "@/lib/dashboard/companies"

import { AgentsTable } from "./agents-table"

type AgentsPageProps = {
  searchParams: Promise<{ company?: string }>
}

export default async function AgentsPage({ searchParams }: AgentsPageProps) {
  const { company } = await searchParams
  const { session, companies, activeCompany } = await getDashboardContext(company)

  if (!activeCompany) {
    redirect("/dashboard?createCompany=1")
  }

  return (
    <DashboardShell
      companies={companies}
      activeCompany={activeCompany}
      activePath="agents"
      username={session.username}
    >
      <section className="rounded-3xl border border-border bg-card p-6 shadow-sm">
        <AgentsTable companyId={activeCompany?.id ?? null} />
      </section>
    </DashboardShell>
  )
}
