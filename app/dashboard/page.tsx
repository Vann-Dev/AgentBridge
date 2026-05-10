import { CreateCompanyDialog } from "@/components/dashboard/create-company-dialog"
import { DashboardShell } from "@/components/dashboard/shell"
import { getDashboardContext } from "@/lib/dashboard/companies"

import { DashboardSummary } from "./dashboard-summary"

type DashboardPageProps = {
  searchParams: Promise<{ company?: string; createCompany?: string }>
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const { company, createCompany } = await searchParams
  const { session, companies, activeCompany } = await getDashboardContext(company)

  return (
    <DashboardShell
      companies={companies}
      activeCompany={activeCompany}
      activePath="overview"
      username={session.username}
    >
      <div className="space-y-6">
        <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
          <p className="text-sm text-muted-foreground">Current company</p>
          <h2 className="mt-1 text-3xl font-semibold tracking-tight">
            {activeCompany?.name ?? "Create your first company"}
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
            {activeCompany?.description ||
              "Companies group your agents, projects, and tasks. Create one to start."}
          </p>
          {!activeCompany ? (
            <div className="mt-5 max-w-48">
              <CreateCompanyDialog defaultOpen={createCompany === "1"} />
            </div>
          ) : null}
        </div>

        <DashboardSummary companyId={activeCompany?.id ?? null} companyCount={companies.length} />
      </div>
    </DashboardShell>
  )
}
