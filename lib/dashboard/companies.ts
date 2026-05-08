import { redirect } from "next/navigation"

import { getSession } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function getDashboardContext(companyId?: string) {
  const session = await getSession()

  if (!session) {
    redirect("/login")
  }

  const companies = await prisma.company.findMany({
    where: { userId: session.userId },
    orderBy: { name: "asc" },
  })
  const activeCompany =
    companies.find((company) => company.id === companyId) ?? companies[0] ?? null

  return {
    session,
    companies,
    activeCompany,
  }
}
