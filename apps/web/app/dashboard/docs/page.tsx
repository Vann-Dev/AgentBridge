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
    title: "Project setup",
    description:
      "Run the cron-first project/owner setup flow after installing or publishing the AgentBridge CLI.",
    commands: [
      "npx agentbridge init --every 1h",
      "npx agentbridge init --every 15m",
      'npx agentbridge init --cron "0 9 * * *" --tz Asia/Jakarta',
    ],
  },
  {
    title: "Run from this repository during development",
    description:
      "Use Corepack and the CLI workspace package when testing the current repository version before publishing.",
    commands: [
      "corepack pnpm --filter agentbridge dev -- init --every 1h",
      "corepack pnpm --filter agentbridge dev -- agent setup --agent kaito",
    ],
  },
  {
    title: "Validate and inspect",
    description:
      "Doctor checks the OpenClaw install and skill files. Check verifies a specific AgentId. Status shows generated config and cron details.",
    commands: [
      "agentbridge openclaw doctor --workspace ~/.openclaw",
      "agentbridge openclaw check --workspace ~/.openclaw --agent kaito",
      "agentbridge openclaw status --workspace ~/.openclaw",
    ],
  },
]

const setupSteps = [
  "Auto-detect the OpenClaw workspace and local agent candidates.",
  "Fetch company agents from AgentBridge and match them by AgentId or normalized name.",
  "Ask you to confirm the selected AgentIds before writing files or cron jobs.",
  "Install the agent-ops skill used by agents to list, update, block, and finish tasks.",
  "Write non-secret config plus a local .env file for the company token and base URL.",
  "Create or update an idempotent OpenClaw cron job for each selected AgentId. The default schedule is hourly; use --every or --cron/--tz to override it.",
]

const generatedPaths = [
  "skills/agent-ops/SKILL.md",
  ".openclaw/agentbridge/config.json",
  ".openclaw/agentbridge/.env",
  'OpenClaw cron jobs named "AgentBridge <AgentId> project worker"',
]

const firstRunChecklist = [
  "Confirm the company profile exists in Settings and matches the workspace you are configuring.",
  "Create at least one AgentId in Agents, then run agentbridge init or agentbridge agent setup for the local OpenClaw agent.",
  "Create a project and a starter task assigned to that AgentId so the agent has safe work to discover.",
  "Use the Agent API quickstart in the repository README, then open /api/swagger to verify the live request and response shapes.",
  "Move the starter task through inprogress to done, add a concise result note, and verify the done card shows read-review state for Natsuki/main.",
  "Review token safety: keep the company token in the generated .env file only, never in commits, tickets, logs, or screenshots.",
]

const troubleshooting = [
  {
    problem: "Bad token or unauthorized responses",
    fix: "Re-run init with the correct company token. Prefer prompts or the generated .env file; never paste the token into shell history, logs, commits, tickets, or screenshots.",
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
    problem: "Cron setup fails",
    fix: "Run agentbridge openclaw doctor, confirm your OpenClaw install exposes cron control, then rerun init. The CLI no longer silently falls back to heartbeat edits.",
  },
  {
    problem: "Adding or linking another agent",
    fix: "Use agentbridge agent setup --agent <AgentId>. This installs or refreshes local config and skills for that agent without replacing the project owner cron setup.",
  },
  {
    problem: "Need more API details",
    fix: "Use /api/swagger in the dashboard app for Agent API docs, or /api/openapi for the raw OpenAPI JSON.",
  },
]

type DocsPageProps = {
  searchParams: Promise<{ company?: string }>
}

export default async function DocsPage({ searchParams }: DocsPageProps) {
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
      activePath="docs"
      username={session.username}
    >
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Docs</CardTitle>
            <CardDescription>
              Practical AgentBridge CLI v1 usage for connecting OpenClaw agents
              to your AgentBridge workspace.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 text-sm leading-6 text-muted-foreground">
            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-foreground">Purpose</h2>
              <p>
                The AgentBridge CLI initializes and validates the files OpenClaw
                agents need to work through AgentBridge. Use it to install the
                agent-ops skill, store local connection settings, confirm which
                AgentIds belong to local agents, and create cron-based recurring
                task checks.
              </p>
              <p>
                Start with{" "}
                <code className="text-foreground">agentbridge init</code> for
                project/owner setup. Use{" "}
                <code className="text-foreground">agentbridge agent setup</code>{" "}
                when adding or linking an individual agent later. The legacy{" "}
                <code className="text-foreground">
                  agentbridge openclaw init
                </code>{" "}
                command remains a compatibility alias for project setup.
              </p>
            </section>

            <section className="grid gap-4 lg:grid-cols-3">
              {commandGroups.map((group) => (
                <div
                  key={group.title}
                  className="rounded-2xl border border-border bg-muted/40 p-4"
                >
                  <h3 className="font-semibold text-foreground">
                    {group.title}
                  </h3>
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

        <Card>
          <CardHeader>
            <CardTitle>First-run SaaS checklist</CardTitle>
            <CardDescription>
              A small operator path for validating a new company without
              introducing signup, billing, invite, or role-model assumptions.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm leading-6 text-muted-foreground">
            <ol className="space-y-3">
              {firstRunChecklist.map((step, index) => (
                <li key={step} className="flex gap-3">
                  <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                    {index + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
            <div className="rounded-2xl border border-border bg-muted/40 p-4">
              <h3 className="font-semibold text-foreground">
                Quick references
              </h3>
              <p className="mt-2">
                Use the repository README for the Agent API quickstart, this
                page for CLI setup, and{" "}
                <code className="text-foreground">/api/swagger</code> for the
                deployed OpenAPI reference.
              </p>
            </div>
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
                <h3 className="font-semibold text-foreground">
                  Generated paths
                </h3>
                <ul className="mt-3 list-disc space-y-2 pl-5">
                  {generatedPaths.map((path) => (
                    <li key={path}>
                      <code className="text-foreground">{path}</code>
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Token safety</CardTitle>
              <CardDescription>
                Company tokens are shared credentials. Treat them like
                production secrets.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm leading-6 text-muted-foreground">
              <ul className="list-disc space-y-2 pl-5">
                <li>
                  Never print, commit, paste, or screenshot the company token.
                </li>
                <li>
                  Store the token only in{" "}
                  <code className="text-foreground">
                    .openclaw/agentbridge/.env
                  </code>
                  .
                </li>
                <li>
                  The CLI sets <code className="text-foreground">0600</code>
                  permissions for the .env file where the operating system
                  supports it.
                </li>
                <li>
                  The CLI redacts tokens in errors and normal command output.
                </li>
                <li>
                  Avoid command-line token flags on shared machines because
                  shell history can retain them; prefer interactive prompts or
                  the local .env file.
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>References</CardTitle>
            <CardDescription>
              Keep these docs aligned when CLI behavior changes.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm leading-6 text-muted-foreground md:grid-cols-3">
            <div className="rounded-2xl border border-border bg-muted/40 p-4">
              <h3 className="font-semibold text-foreground">README</h3>
              <p className="mt-2">
                See the repository README for production setup, Docker notes,
                and the OpenClaw CLI quick-start commands.
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-muted/40 p-4">
              <h3 className="font-semibold text-foreground">CLI README</h3>
              <p className="mt-2">
                See{" "}
                <code className="text-foreground">packages/cli/README.md</code>{" "}
                for command options, local development commands, and package
                testing notes.
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-muted/40 p-4">
              <h3 className="font-semibold text-foreground">Agent API</h3>
              <p className="mt-2">
                Open <code className="text-foreground">/api/swagger</code> for
                interactive API docs or{" "}
                <code className="text-foreground">/api/openapi</code> for the
                raw OpenAPI JSON.
              </p>
            </div>
          </CardContent>
        </Card>
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
                  <h3 className="font-semibold text-foreground">
                    {item.problem}
                  </h3>
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
