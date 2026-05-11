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

const commandGroups = [
  {
    title: "Initialize OpenClaw agents",
    description:
      "Run this from an installed AgentBridge CLI to connect local OpenClaw agents to the active AgentBridge company.",
    commands: ["agentbridge openclaw init"],
  },
  {
    title: "Run from this repository during development",
    description:
      "Use the filter command directly, or the corepack-safe workspace script, when testing the CLI before publishing or installing it globally.",
    commands: [
      "corepack pnpm --filter @agentbridge/cli dev -- openclaw init",
      "corepack pnpm cli:dev -- openclaw init",
    ],
  },
  {
    title: "Validate a workspace",
    description:
      "Doctor checks the OpenClaw install and skill files. Check verifies a specific AgentId against AgentBridge.",
    commands: [
      "agentbridge openclaw doctor",
      "agentbridge openclaw check --agent <AgentId>",
      "agentbridge openclaw doctor --workspace ~/.openclaw",
      "agentbridge openclaw check --workspace ~/.openclaw --agent kaito",
    ],
  },
]

const setupSteps = [
  "Auto-detect the OpenClaw workspace and local agent candidates.",
  "Fetch company agents from AgentBridge and match them by AgentId or normalized name.",
  "Ask you to confirm the selected AgentIds before writing files.",
  "Install the agent-ops skill used by agents to list, update, block, and finish tasks.",
  "Write non-secret configuration plus a local .env file for the company token.",
  "Add a heartbeat task-check marker to HEARTBEAT.md. Heartbeat is the default setup; cron is not the default workflow.",
]

const troubleshooting = [
  {
    problem: "Bad token or unauthorized responses",
    fix: "Re-run init with the correct company token. Never paste the token into logs, commits, tickets, or screenshots.",
  },
  {
    problem: "AgentId not found",
    fix: "Confirm the agent exists in the dashboard and pass the exact AgentId, for example agentbridge openclaw check --agent kaito.",
  },
  {
    problem: "Workspace not detected",
    fix: "Run from the OpenClaw workspace or pass --workspace explicitly, such as --workspace ~/.openclaw.",
  },
  {
    problem: "agent-ops skill missing",
    fix: "Run agentbridge openclaw doctor, then run init again to reinstall skills/agent-ops/SKILL.md.",
  },
]

type DocsPageProps = {
  searchParams: Promise<{ company?: string }>
}

export default async function DocsPage({ searchParams }: DocsPageProps) {
  const { company } = await searchParams
  const { session, companies, activeCompany } = await getDashboardContext(company)

  if (!activeCompany) {
    redirect("/dashboard?createCompany=1")
  }

  return (
    <DashboardShell
      companies={companies}
      activeCompany={activeCompany}
      activePath="docs"
      username={session.username}
    >
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Docs</CardTitle>
            <CardDescription>
              Practical AgentBridge CLI v1 usage for connecting OpenClaw agents to
              your AgentBridge workspace.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 text-sm leading-6 text-muted-foreground">
            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-foreground">Purpose</h2>
              <p>
                The AgentBridge CLI initializes and validates the files OpenClaw
                agents need to work through AgentBridge. Use it to install the
                agent-ops skill, store local connection settings, confirm which
                AgentIds belong to local agents, and set up heartbeat-based task
                checks.
              </p>
            </section>

            <section className="grid gap-4 lg:grid-cols-3">
              {commandGroups.map((group) => (
                <div
                  key={group.title}
                  className="rounded-2xl border border-border bg-muted/40 p-4"
                >
                  <h3 className="font-semibold text-foreground">{group.title}</h3>
                  <p className="mt-2">{group.description}</p>
                  <div className="mt-4 space-y-2">
                    {group.commands.map((command) => (
                      <code
                        key={command}
                        className="block overflow-x-auto rounded-xl bg-background px-3 py-2 font-mono text-xs text-foreground"
                      >
                        {command}
                      </code>
                    ))}
                  </div>
                </div>
              ))}
            </section>
          </CardContent>
        </Card>

        <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <Card>
            <CardHeader>
              <CardTitle>What init writes</CardTitle>
              <CardDescription>
                The CLI keeps generated files local to the OpenClaw workspace.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm leading-6 text-muted-foreground">
              <ol className="space-y-3">
                {setupSteps.map((step, index) => (
                  <li key={step} className="flex gap-3">
                    <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                      {index + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
              <div className="rounded-2xl border border-border bg-muted/40 p-4">
                <h3 className="font-semibold text-foreground">Generated paths</h3>
                <ul className="mt-3 list-disc space-y-2 pl-5">
                  <li>
                    <code className="text-foreground">skills/agent-ops/SKILL.md</code>
                  </li>
                  <li>
                    <code className="text-foreground">
                      .openclaw/agentbridge/config.json
                    </code>
                  </li>
                  <li>
                    <code className="text-foreground">.openclaw/agentbridge/.env</code>
                  </li>
                  <li>
                    AgentBridge-managed marker block in{" "}
                    <code className="text-foreground">HEARTBEAT.md</code>
                  </li>
                </ul>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Token safety</CardTitle>
              <CardDescription>
                Company tokens are shared credentials. Treat them like production
                secrets.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm leading-6 text-muted-foreground">
              <ul className="list-disc space-y-2 pl-5">
                <li>Never print, commit, paste, or screenshot the company token.</li>
                <li>
                  Store the token only in{" "}
                  <code className="text-foreground">.openclaw/agentbridge/.env</code>.
                </li>
                <li>
                  The CLI sets <code className="text-foreground">0600</code>
                  permissions for the .env file where the operating system supports
                  it.
                </li>
                <li>
                  The CLI redacts tokens in errors and normal command output.
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Troubleshooting</CardTitle>
            <CardDescription>
              Common OpenClaw setup issues and the fastest fix for each one.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2">
              {troubleshooting.map((item) => (
                <div
                  key={item.problem}
                  className="rounded-2xl border border-border bg-muted/40 p-4 text-sm leading-6"
                >
                  <h3 className="font-semibold text-foreground">{item.problem}</h3>
                  <p className="mt-2 text-muted-foreground">{item.fix}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  )
}
