import { redirect } from "next/navigation"

import { DashboardShell } from "@/components/dashboard/shell"
import { getDashboardContext } from "@/lib/dashboard/companies"

import { CompanySettingsForm } from "./company-settings-form"

type SettingsPageProps = {
  searchParams: Promise<{ company?: string }>
}

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const { company } = await searchParams
  const { session, companies, activeCompany } = await getDashboardContext(company)

  if (!activeCompany) {
    redirect("/dashboard?createCompany=1")
  }

  return (
    <DashboardShell
      companies={companies}
      activeCompany={activeCompany}
      activePath="settings"
      username={session.username}
    >
      <CompanySettingsForm company={activeCompany} />
    </DashboardShell>
  )
}
