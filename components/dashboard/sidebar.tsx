import Link from "next/link"

import { Button } from "@/components/ui/button"
import { CreateCompanyDialog } from "@/components/dashboard/create-company-dialog"
import { cn } from "@/lib/utils"

type Company = {
  id: string
  name: string
}

type DashboardSidebarProps = {
  companies: Company[]
  activeCompany: Company | null
  activePath: "overview" | "agents" | "projects"
  username: string
}

function dashboardHref(companyId: string | null, path = "") {
  const search = companyId ? `?company=${companyId}` : ""
  return `/dashboard${path}${search}`
}

export function DashboardSidebar({
  companies,
  activeCompany,
  activePath,
  username,
}: DashboardSidebarProps) {
  const nav = [
    { label: "Agents", href: dashboardHref(activeCompany?.id ?? null, "/agents"), key: "agents" },
    {
      label: "Projects",
      href: dashboardHref(activeCompany?.id ?? null, "/projects"),
      key: "projects",
    },
  ] as const

  return (
    <aside className="flex min-h-svh w-full flex-col border-r border-border bg-card p-4 md:w-72">
      <Link href={dashboardHref(activeCompany?.id ?? null)} className="mb-6 block">
        <p className="text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">
          AgentBridge
        </p>
        <h1 className="mt-1 text-xl font-semibold">Dashboard</h1>
      </Link>

      <div className="space-y-2">
        <label className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Company
        </label>
        <details className="group rounded-2xl border border-border bg-background p-2" open>
          <summary className="flex cursor-pointer list-none items-center justify-between rounded-xl px-3 py-2 text-sm font-medium">
            <span className="truncate">{activeCompany?.name ?? "No company"}</span>
            <span className="text-muted-foreground transition group-open:rotate-180">⌄</span>
          </summary>
          <div className="mt-2 space-y-1 border-t border-border pt-2">
            {companies.map((company) => (
              <Link
                key={company.id}
                href={dashboardHref(company.id)}
                className={cn(
                  "block rounded-xl px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground",
                  activeCompany?.id === company.id && "bg-muted text-foreground"
                )}
              >
                {company.name}
              </Link>
            ))}
            <CreateCompanyDialog />
          </div>
        </details>
      </div>

      <nav className="mt-6 space-y-1">
        {nav.map((item) => (
          <Link
            key={item.key}
            href={item.href}
            className={cn(
              "block rounded-2xl px-4 py-3 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground",
              activePath === item.key && "bg-muted text-foreground"
            )}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="mt-auto space-y-3 rounded-2xl bg-muted p-3 text-sm">
        <p className="text-muted-foreground">Signed in as</p>
        <p className="font-medium">{username}</p>
        <form action="/logout" method="post">
          <Button className="w-full" variant="outline" size="sm" type="submit">
            Log out
          </Button>
        </form>
      </div>
    </aside>
  )
}
