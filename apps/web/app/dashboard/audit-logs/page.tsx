import { redirect } from "next/navigation"

import { DashboardShell } from "@/components/dashboard/shell"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { getDashboardContext } from "@/lib/dashboard/companies"
import { prisma } from "@/lib/prisma"

import { AuditLogList } from "./audit-log-list"

type AuditLogsPageProps = {
  searchParams: Promise<{ company?: string }>
}

export default async function AuditLogsPage({ searchParams }: AuditLogsPageProps) {
  const { company } = await searchParams
  const { session, companies, activeCompany } = await getDashboardContext(company)

  if (!activeCompany) {
    redirect("/dashboard?createCompany=1")
  }

  const auditLogs = await prisma.auditLog.findMany({
    where: { companyId: activeCompany.id },
    orderBy: { createdAt: "desc" },
    take: 100,
  })

  return (
    <DashboardShell
      companies={companies}
      activeCompany={activeCompany}
      activePath="audit-logs"
      username={session.username}
    >
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Audit Log</CardTitle>
          <CardDescription>
            Review recent company-scoped activity across projects, tasks, and agents.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AuditLogList auditLogs={auditLogs} />
        </CardContent>
      </Card>
    </DashboardShell>
  )
}
