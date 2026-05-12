import { redirect } from "next/navigation"

import { DashboardShell } from "@/components/dashboard/shell"
import { getDashboardContext } from "@/lib/dashboard/companies"

import { BriefClient } from "./brief-client"

type BriefPageProps = {
  searchParams: Promise<{ company?: string }>
}

export default async function BriefPage({ searchParams }: BriefPageProps) {
  const { company } = await searchParams
  const { session, companies, activeCompany } =
    await getDashboardContext(company)

  if (!activeCompany) {
    redirect("/dashboard?createCompany=1")
  }

  return (
    <DashboardShell
      companies={companies}
      activeCompany={activeCompany}
      activePath="brief"
      username={session.username}
    >
      <BriefClient companyId={activeCompany.id} />
    </DashboardShell>
  )
}
