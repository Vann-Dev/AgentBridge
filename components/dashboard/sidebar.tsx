import type { ComponentType } from "react"
import Link from "next/link"
import {
  BotIcon,
  Building2Icon,
  ClipboardListIcon,
  HomeIcon,
  NotebookTextIcon,
  ScrollTextIcon,
  SettingsIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { ChangePasswordDialog } from "@/components/dashboard/change-password-dialog"
import { ChangeUsernameDialog } from "@/components/dashboard/change-username-dialog"
import { CreateCompanyDialog } from "@/components/dashboard/create-company-dialog"
import { cn } from "@/lib/utils"

type Company = {
  id: string
  name: string
}

type DashboardSidebarProps = {
  companies: Company[]
  activeCompany: Company | null
  activePath: "overview" | "agents" | "projects" | "notes" | "audit-logs" | "settings"
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
  const primaryNav = [
    {
      label: "Overview",
      href: dashboardHref(activeCompany?.id ?? null),
      key: "overview",
      icon: HomeIcon,
    },
    {
      label: "Agents",
      href: dashboardHref(activeCompany?.id ?? null, "/agents"),
      key: "agents",
      icon: BotIcon,
    },
    {
      label: "Projects",
      href: dashboardHref(activeCompany?.id ?? null, "/projects"),
      key: "projects",
      icon: ClipboardListIcon,
    },
    {
      label: "Notes",
      href: dashboardHref(activeCompany?.id ?? null, "/notes"),
      key: "notes",
      icon: NotebookTextIcon,
    },
    {
      label: "Audit Log",
      href: dashboardHref(activeCompany?.id ?? null, "/audit-logs"),
      key: "audit-logs",
      icon: ScrollTextIcon,
    },
  ] as const
  const secondaryNav = [
    {
      label: "Settings",
      href: dashboardHref(activeCompany?.id ?? null, "/settings"),
      key: "settings",
      icon: SettingsIcon,
    },
  ] as const

  return (
    <aside className="flex min-h-svh w-full flex-col border-r border-border bg-card/95 p-4 md:w-72">
      <Link
        href={dashboardHref(activeCompany?.id ?? null)}
        className="mb-6 rounded-3xl px-2 py-1 transition hover:bg-muted/70"
      >
        <p className="text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">
          AgentBridge
        </p>
        <h1 className="mt-1 text-xl font-semibold">Dashboard</h1>
      </Link>

      <div className="space-y-2">
        <label className="flex items-center gap-2 px-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          <Building2Icon className="size-3.5" />
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
                  "block rounded-xl px-3 py-2 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground",
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

      <nav className="mt-6 space-y-6">
        <SidebarNavGroup label="Workspace" activePath={activePath} items={primaryNav} />
        <SidebarNavGroup label="Manage" activePath={activePath} items={secondaryNav} />
      </nav>

      <div className="mt-auto space-y-3 rounded-2xl border border-border bg-muted/70 p-3 text-sm">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
            Signed in as
          </p>
          <p className="mt-1 truncate font-medium">{username}</p>
        </div>
        <ChangeUsernameDialog username={username} />
        <ChangePasswordDialog />
        <form action="/logout" method="post">
          <Button className="w-full" variant="outline" size="sm" type="submit">
            Log out
          </Button>
        </form>
      </div>
    </aside>
  )
}

type SidebarItem = {
  label: string
  href: string
  key: DashboardSidebarProps["activePath"]
  icon: ComponentType<{ className?: string }>
}

function SidebarNavGroup({
  label,
  activePath,
  items,
}: {
  label: string
  activePath: DashboardSidebarProps["activePath"]
  items: readonly SidebarItem[]
}) {
  return (
    <div className="space-y-2">
      <p className="px-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </p>
      <div className="space-y-1">
        {items.map((item) => {
          const Icon = item.icon

          return (
            <Link
              key={item.key}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground",
                activePath === item.key &&
                  "bg-primary text-primary-foreground shadow-sm hover:bg-primary hover:text-primary-foreground"
              )}
            >
              <Icon className="size-4" />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
