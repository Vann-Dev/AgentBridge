import type { ComponentType } from "react"
import Link from "next/link"
import {
  BotIcon,
  Building2Icon,
  CheckIcon,
  ChevronsUpDownIcon,
  ClipboardListIcon,
  FileTextIcon,
  HomeIcon,
  NotebookTextIcon,
  PlusIcon,
  ScrollTextIcon,
  SettingsIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { ChangePasswordDialog } from "@/components/dashboard/change-password-dialog"
import { ChangeUsernameDialog } from "@/components/dashboard/change-username-dialog"
import { CreateCompanyDialog } from "@/components/dashboard/create-company-dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

type Company = {
  id: string
  name: string
}

type DashboardSidebarProps = {
  companies: Company[]
  activeCompany: Company | null
  activePath:
    | "overview"
    | "agents"
    | "projects"
    | "notes"
    | "docs"
    | "audit-logs"
    | "settings"
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
      label: "Docs",
      href: dashboardHref(activeCompany?.id ?? null, "/docs"),
      key: "docs",
      icon: FileTextIcon,
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
        <p className="flex items-center gap-2 px-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          <Building2Icon className="size-3.5" />
          Company
        </p>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="group flex w-full items-center gap-3 rounded-3xl border border-border/80 bg-background/80 p-3 text-left shadow-sm transition hover:border-primary/30 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card data-[state=open]:border-primary/40 data-[state=open]:bg-muted/60"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/15">
                <Building2Icon className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[0.68rem] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  Active workspace
                </span>
                <span className="mt-0.5 block truncate text-sm font-semibold text-foreground">
                  {activeCompany?.name ?? "No company selected"}
                </span>
              </span>
              <ChevronsUpDownIcon className="size-4 shrink-0 text-muted-foreground transition group-hover:text-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-[16rem] p-2" sideOffset={8}>
            <DropdownMenuLabel className="px-2 py-1.5">
              <span className="text-[0.68rem] font-medium uppercase tracking-[0.16em]">
                Switch company
              </span>
            </DropdownMenuLabel>
            {companies.length ? (
              <div className="max-h-64 overflow-y-auto">
                {companies.map((company) => {
                  const isActive = activeCompany?.id === company.id

                  return (
                    <DropdownMenuItem key={company.id} asChild>
                      <Link
                        href={dashboardHref(company.id)}
                        className={cn(
                          "flex min-w-0 items-center gap-2 rounded-xl px-2.5 py-2.5",
                          isActive && "bg-accent text-accent-foreground"
                        )}
                      >
                        <span className="min-w-0 flex-1 truncate font-medium">
                          {company.name}
                        </span>
                        {isActive ? (
                          <CheckIcon className="size-4 shrink-0 text-primary" />
                        ) : null}
                      </Link>
                    </DropdownMenuItem>
                  )
                })}
              </div>
            ) : (
              <p className="px-2.5 py-3 text-sm text-muted-foreground">
                Create a company to start organizing agents and projects.
              </p>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link
                href={dashboardHref(activeCompany?.id ?? null, "/settings")}
                className="flex items-center gap-2 rounded-xl px-2.5 py-2.5"
              >
                <SettingsIcon className="size-4 text-muted-foreground" />
                <span className="font-medium">Company settings</span>
              </Link>
            </DropdownMenuItem>
            <CreateCompanyDialog
              trigger={
                <DropdownMenuItem
                  onSelect={(event) => event.preventDefault()}
                  className="gap-2 px-2.5 py-2.5"
                >
                  <PlusIcon className="size-4 text-muted-foreground" />
                  <span className="font-medium">Create company</span>
                </DropdownMenuItem>
              }
            />
          </DropdownMenuContent>
        </DropdownMenu>
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
