#!/usr/bin/env node

import { createInterface } from "node:readline/promises"
import { stdin as input, stdout as output } from "node:process"
import { execFile } from "node:child_process"
import { promisify } from "node:util"
import { constants, existsSync } from "node:fs"
import {
  access,
  chmod,
  copyFile,
  mkdir,
  readFile,
  readdir,
  stat,
  writeFile,
} from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"

type AgentBridgeAgent = {
  id: string
  AgentId: string
  name: string
  position: string
  description?: string
}

type ConfigAgent = {
  AgentId: string
  name: string
  position: string
  source: string
}

type Config = {
  baseUrl: string
  agents: ConfigAgent[]
  installedAt: string
  installVersion: string
  skillPath: string
  heartbeatFile?: string
  cronJobs?: ConfigCronJob[]
  project?: ConfigProject
}

type ConfigCronJob = {
  agentId: string
  name: string
  schedule: string
  jobId?: string
}

type ConfigProject = {
  id?: string
  name: string
  repository?: string
}

type Candidate = {
  agentId: string
  name: string
  source: string
}

type Match = {
  candidate: Candidate
  agent: AgentBridgeAgent
  match: "AgentId" | "name"
}

type RequestOptions = {
  baseUrl: string
  token: string
  agentId: string
  pathname: string
}

const VERSION = "0.1.0"
const execFileAsync = promisify(execFile)

function usage() {
  console.log(`AgentBridge CLI v${VERSION}

Usage:
  agentbridge init [--workspace <path>] [--base-url <url>] [--project-id <id>] [--project-name <name>] [--repo <url>] [--agent <AgentId>] [--every <duration>|--cron <expr>] [--tz <iana>] [--dry-run] [--yes]
  agentbridge agent setup [--workspace <path>] [--base-url <url>] [--agent <AgentId>] [--all-detected] [--dry-run] [--yes]
  agentbridge openclaw init [same as agentbridge init]
  agentbridge openclaw doctor [--workspace <path>] [--base-url <url>] [--token <token>] [--agent <AgentId>]
  agentbridge openclaw check [--workspace <path>] [--base-url <url>] [--token <token>] [--agent <AgentId>]
  agentbridge openclaw status [--workspace <path>]

Project init creates or updates an OpenClaw cron job for recurring AgentBridge checks.
Agent setup only links/configures agents and skills. Tokens are redacted from logs.
When --workspace is provided it is used exactly; global ~/.openclaw/agents are only considered with --all-detected.`)
}

function parseArgs(argv: string[]) {
  const positional: string[] = []
  const flags = new Map<string, string | boolean>()

  for (let i = 0; i < argv.length; i += 1) {
    const value = argv[i]

    if (!value.startsWith("--")) {
      positional.push(value)
      continue
    }

    const [rawKey, inlineValue] = value.slice(2).split("=", 2)
    if (inlineValue !== undefined) {
      flags.set(rawKey, inlineValue)
      continue
    }

    const next = argv[i + 1]
    if (next && !next.startsWith("--")) {
      flags.set(rawKey, next)
      i += 1
    } else {
      flags.set(rawKey, true)
    }
  }

  return { positional, flags }
}

function flagString(flags: Map<string, string | boolean>, name: string) {
  const value = flags.get(name)
  return typeof value === "string" ? value : undefined
}

function normalize(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .trim()
}

function redact(value: string) {
  return value
    .replace(/Bearer\s+[^\s]+/gi, "Bearer [redacted]")
    .replace(/[A-Za-z0-9_-]{24,}/g, "[redacted]")
}

function parseDurationMs(value: string) {
  const match = value.trim().match(/^(\d+)\s*(s|m|h|d)$/i)
  if (!match) return null

  const amount = Number.parseInt(match[1], 10)
  const unit = match[2].toLowerCase()
  const multipliers = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }
  return amount * multipliers[unit as keyof typeof multipliers]
}

function normalizeSchedule(flags: Map<string, string | boolean>) {
  const cron = flagString(flags, "cron")
  if (cron) {
    return {
      kind: "cron" as const,
      label: cron,
      args: [
        "--cron",
        cron,
        ...(flagString(flags, "tz")
          ? ["--tz", flagString(flags, "tz") as string]
          : []),
      ],
    }
  }

  const every = flagString(flags, "every") ?? "1h"
  if (!parseDurationMs(every)) {
    throw new Error("Invalid --every value. Use durations like 15m, 1h, or 1d.")
  }

  return {
    kind: "every" as const,
    label: every,
    args: ["--every", every],
  }
}

async function pathExists(target: string) {
  try {
    await access(target, constants.F_OK)
    return true
  } catch {
    return false
  }
}

async function detectWorkspace(preferred?: string) {
  if (preferred) return path.resolve(preferred)

  const candidates = [
    process.env.OPENCLAW_HOME,
    path.join(os.homedir(), ".openclaw"),
    process.cwd(),
    ...parents(process.cwd()),
  ].filter(Boolean) as string[]

  for (const candidate of candidates) {
    const resolved = path.resolve(candidate)
    if (await looksLikeOpenClawWorkspace(resolved)) {
      return resolved
    }
  }

  return path.resolve(process.cwd())
}

function parents(start: string) {
  const values: string[] = []
  let current = path.resolve(start)

  while (current !== path.dirname(current)) {
    current = path.dirname(current)
    values.push(current)
  }

  return values
}

async function looksLikeOpenClawWorkspace(directory: string) {
  const names = [".openclaw", "HEARTBEAT.md", "AGENTS.md", "SOUL.md", "skills"]
  for (const name of names) {
    if (await pathExists(path.join(directory, name))) {
      return true
    }
  }

  return false
}

async function detectLocalAgents(
  workspace: string,
  options?: { includeGlobalAgents?: boolean }
) {
  const candidates = new Map<string, Candidate>()
  const add = (agentId: string, name: string, source: string) => {
    const clean = agentId.trim().toLowerCase()
    if (!clean || candidates.has(clean)) return
    candidates.set(clean, {
      agentId: clean,
      name: name.trim() || clean,
      source,
    })
  }

  const basename = path.basename(workspace)
  const workspaceMatch = basename.match(/workspace[-_]?([a-z0-9][a-z0-9_-]*)/i)
  if (workspaceMatch?.[1])
    add(workspaceMatch[1], workspaceMatch[1], `workspace name ${basename}`)

  for (const file of ["IDENTITY.md", "SOUL.md", "AGENTS.md"]) {
    const filePath = path.join(workspace, file)
    if (!(await pathExists(filePath))) continue

    const content = await readFile(filePath, "utf8")
    for (const pattern of [
      /AgentId\s*[:=]\s*`?([a-zA-Z0-9_-]+)`?/g,
      /agent id\s*[:=]\s*`?([a-zA-Z0-9_-]+)`?/gi,
      /\bID agent\b\s*[:=]\s*`?([a-zA-Z0-9_-]+)`?/gi,
      /\b(kaito|tamiko|ume|natsuki|main)\b/gi,
    ]) {
      for (const match of content.matchAll(pattern)) {
        add(match[1], match[1], file)
      }
    }
  }

  const agentDirs = [path.join(workspace, ".openclaw", "agents")]
  if (options?.includeGlobalAgents) {
    agentDirs.push(path.join(os.homedir(), ".openclaw", "agents"))
  }

  for (const dir of agentDirs) {
    if (!(await pathExists(dir))) continue
    const entries = await readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue
      const id = entry.name.replace(/\.(json|md|toml|yaml|yml)$/i, "")
      add(id, id, dir)
    }
  }

  return [...candidates.values()]
}

async function requestJson<T>(options: RequestOptions): Promise<T> {
  const url = new URL(options.pathname, options.baseUrl.replace(/\/$/, ""))
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${options.token}`,
      AgentId: options.agentId,
    },
  })
  const text = await response.text()
  const json = text ? JSON.parse(text) : {}

  if (!response.ok) {
    const error = json?.error ? String(json.error) : response.statusText
    throw new Error(`${response.status} ${redact(error)}`)
  }

  return json as T
}

async function fetchAgents(
  baseUrl: string,
  token: string,
  provisionalAgentId: string
) {
  const data = await requestJson<{ agents: AgentBridgeAgent[] }>({
    baseUrl,
    token,
    agentId: provisionalAgentId,
    pathname: "/api/agent/agents",
  })

  return data.agents
}

async function fetchAgentsWithFallback(
  baseUrl: string,
  token: string,
  provisionalAgentIds: Array<string | undefined>
) {
  const attempts = uniqueStrings([
    ...provisionalAgentIds,
    process.env.AGENTBRIDGE_AGENT_ID,
    "main",
    "natsuki",
    "kaito",
    "tamiko",
    "ume",
  ])
  const failures: string[] = []

  for (const agentId of attempts) {
    try {
      return {
        agents: await fetchAgents(baseUrl, token, agentId),
        authenticatedAgentId: agentId,
      }
    } catch (error) {
      failures.push(
        `${agentId}: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  const manualAgentId = await prompt(
    "Enter a valid AgentBridge AgentId to fetch available agents"
  )
  if (manualAgentId) {
    return {
      agents: await fetchAgents(baseUrl, token, manualAgentId),
      authenticatedAgentId: manualAgentId,
    }
  }

  throw new Error(
    `Could not fetch AgentBridge agents with detected AgentIds. ${failures.map(redact).join("; ")}`
  )
}

function uniqueStrings(values: Array<string | undefined>) {
  const strings: string[] = []
  for (const value of values) {
    const trimmed = value?.trim()
    if (trimmed) strings.push(trimmed)
  }
  return [...new Set(strings)]
}

function matchAgents(candidates: Candidate[], agents: AgentBridgeAgent[]) {
  const matches: Match[] = []
  const byAgentId = new Map(
    agents.map((agent) => [normalize(agent.AgentId), agent])
  )
  const byName = new Map(agents.map((agent) => [normalize(agent.name), agent]))

  for (const candidate of candidates) {
    const idMatch = byAgentId.get(normalize(candidate.agentId))
    if (idMatch) {
      matches.push({ candidate, agent: idMatch, match: "AgentId" })
      continue
    }

    const nameMatch = byName.get(normalize(candidate.name))
    if (nameMatch) matches.push({ candidate, agent: nameMatch, match: "name" })
  }

  return matches
}

async function prompt(question: string, defaultValue?: string) {
  const rl = createInterface({ input, output })
  const suffix = defaultValue ? ` (${defaultValue})` : ""
  const answer = await rl.question(`${question}${suffix}: `)
  rl.close()
  return answer.trim() || defaultValue || ""
}

async function promptSecret(question: string) {
  if (!process.stdin.isTTY) {
    return prompt(question)
  }

  const mutableOutput = output as NodeJS.WriteStream & { muted?: boolean }
  const originalWrite = mutableOutput.write.bind(mutableOutput)
  mutableOutput.muted = false
  mutableOutput.write = ((
    chunk: Uint8Array | string,
    encoding?: BufferEncoding | ((error?: Error | null) => void),
    callback?: (error?: Error | null) => void
  ) => {
    if (!mutableOutput.muted) {
      return originalWrite(
        chunk as string,
        encoding as BufferEncoding,
        callback
      )
    }
    return true
  }) as typeof output.write

  const rl = createInterface({ input, output: mutableOutput })
  mutableOutput.muted = true
  const answer = await rl.question(`${question}: `)
  mutableOutput.muted = false
  originalWrite("\n")
  rl.close()
  mutableOutput.write = originalWrite as typeof output.write

  return answer.trim()
}

async function selectAgents(
  matches: Match[],
  agents: AgentBridgeAgent[],
  manualAgentId?: string
) {
  if (manualAgentId) {
    const found = agents.find((agent) => agent.AgentId === manualAgentId)
    if (!found)
      throw new Error(`AgentId ${manualAgentId} was not found in AgentBridge.`)
    return [found]
  }

  if (matches.length === 0) {
    console.log("No OpenClaw agent candidates matched AgentBridge agents.")
    const answer = await prompt(
      "Enter an AgentBridge AgentId to link manually, or leave blank to cancel"
    )
    if (!answer) return []
    const found = agents.find((agent) => agent.AgentId === answer)
    if (!found)
      throw new Error(`AgentId ${answer} was not found in AgentBridge.`)
    return [found]
  }

  console.log("Detected OpenClaw → AgentBridge matches:")
  matches.forEach((match, index) => {
    console.log(
      `  ${index + 1}. ${match.agent.AgentId} (${match.agent.name}, ${match.agent.position}) matched by ${match.match} from ${match.candidate.source}`
    )
  })

  const answer = await prompt(
    "Select agents by number, comma-separated, or press Enter for all detected",
    "all"
  )
  if (answer.toLowerCase() === "all")
    return uniqueAgents(matches.map((match) => match.agent))

  const selected = answer
    .split(",")
    .map((value) => Number.parseInt(value.trim(), 10) - 1)
    .filter(
      (index) => Number.isInteger(index) && index >= 0 && index < matches.length
    )
    .map((index) => matches[index].agent)

  return uniqueAgents(selected)
}

function uniqueAgents(agents: AgentBridgeAgent[]) {
  return [...new Map(agents.map((agent) => [agent.AgentId, agent])).values()]
}

function repoRoot() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..")
}

async function installOpenClawBase(options: {
  workspace: string
  baseUrl: string
  token: string
  agents: AgentBridgeAgent[]
  project?: ConfigProject
  cronJobs?: ConfigCronJob[]
}) {
  const agentbridgeDir = path.join(
    options.workspace,
    ".openclaw",
    "agentbridge"
  )
  const skillDir = path.join(options.workspace, "skills", "agent-ops")
  const skillSource = path.join(repoRoot(), "agent-skill", "SKILL.md")
  const skillTarget = path.join(skillDir, "SKILL.md")
  const envTarget = path.join(agentbridgeDir, ".env")
  const configTarget = path.join(agentbridgeDir, "config.json")
  const previousConfig = await readConfig(options.workspace)
  const config: Config = {
    baseUrl: options.baseUrl,
    agents: options.agents.map((agent) => ({
      AgentId: agent.AgentId,
      name: agent.name,
      position: agent.position,
      source: "AgentBridge",
    })),
    installedAt: previousConfig?.installedAt ?? new Date().toISOString(),
    installVersion: VERSION,
    skillPath: path.relative(options.workspace, skillTarget),
    project: options.project ?? previousConfig?.project,
    cronJobs: options.cronJobs ?? previousConfig?.cronJobs,
  }

  await mkdir(agentbridgeDir, { recursive: true })
  await mkdir(skillDir, { recursive: true })
  await writeFile(configTarget, `${JSON.stringify(config, null, 2)}\n`, "utf8")
  await writeFile(
    envTarget,
    `# AgentBridge secrets for OpenClaw. Do not commit this file.\nAGENTBRIDGE_BASE_URL=${JSON.stringify(options.baseUrl)}\nAGENTBRIDGE_COMPANY_TOKEN=${JSON.stringify(options.token)}\n`,
    "utf8"
  )
  await chmod(envTarget, 0o600).catch(() => undefined)
  await copyFile(skillSource, skillTarget)
}

async function installAgentSetup(options: {
  workspace: string
  baseUrl: string
  token: string
  agents: AgentBridgeAgent[]
  dryRun: boolean
  yes: boolean
}) {
  const agentbridgeDir = path.join(
    options.workspace,
    ".openclaw",
    "agentbridge"
  )
  const skillTarget = path.join(
    options.workspace,
    "skills",
    "agent-ops",
    "SKILL.md"
  )
  const envTarget = path.join(agentbridgeDir, ".env")
  const configTarget = path.join(agentbridgeDir, "config.json")

  console.log("Planned agent setup changes:")
  console.log(
    `  write ${path.relative(options.workspace, configTarget)} (no secrets)`
  )
  console.log(
    `  write ${path.relative(options.workspace, envTarget)} (token secret, chmod 0600 where supported)`
  )
  console.log(`  copy  ${path.relative(options.workspace, skillTarget)}`)
  console.log(
    "  cron  no changes (agent setup does not create project cron jobs)"
  )

  if (options.dryRun) return
  if (!(await confirmChanges(options.yes))) return

  await installOpenClawBase(options)
  console.log("AgentBridge OpenClaw agent setup complete.")
}

async function confirmChanges(yes: boolean) {
  if (yes) return true

  const confirmed = await prompt("Apply these changes? Type yes to continue")
  if (confirmed.toLowerCase() !== "yes") {
    console.log("Canceled without writing files.")
    return false
  }

  return true
}

async function installProjectInit(options: {
  workspace: string
  baseUrl: string
  token: string
  agents: AgentBridgeAgent[]
  project: ConfigProject
  schedule: ReturnType<typeof normalizeSchedule>
  dryRun: boolean
  yes: boolean
}) {
  const agentbridgeDir = path.join(
    options.workspace,
    ".openclaw",
    "agentbridge"
  )
  const skillTarget = path.join(
    options.workspace,
    "skills",
    "agent-ops",
    "SKILL.md"
  )
  const envTarget = path.join(agentbridgeDir, ".env")
  const configTarget = path.join(agentbridgeDir, "config.json")
  console.log("Planned project init changes:")
  console.log(
    `  write ${path.relative(options.workspace, configTarget)} (no secrets)`
  )
  console.log(
    `  write ${path.relative(options.workspace, envTarget)} (token secret, chmod 0600 where supported)`
  )
  console.log(`  copy  ${path.relative(options.workspace, skillTarget)}`)
  console.log(
    `  cron  create/update ${options.agents.length} AgentBridge OpenClaw job(s) (${options.schedule.label})`
  )
  console.log("  skip  HEARTBEAT.md (cron is the recurring workflow)")

  if (options.dryRun) return
  if (!(await confirmChanges(options.yes))) return

  const installedCronJobs = await upsertOpenClawCronJobs({
    workspace: options.workspace,
    baseUrl: options.baseUrl,
    agents: options.agents,
    project: options.project,
    schedule: options.schedule,
  })

  await installOpenClawBase({
    ...options,
    cronJobs: installedCronJobs,
  })
  console.log("AgentBridge OpenClaw cron setup complete.")
}

function cronJobName(agentId: string) {
  return `AgentBridge ${agentId} project worker`
}

async function upsertOpenClawCronJobs(options: {
  workspace: string
  baseUrl: string
  agents: AgentBridgeAgent[]
  project: ConfigProject
  schedule: ReturnType<typeof normalizeSchedule>
}) {
  const openclaw = await findOpenClawBinary()
  const jobs = await listOpenClawCronJobs(openclaw)
  const installed: ConfigCronJob[] = []

  for (const agent of options.agents) {
    const name = cronJobName(agent.AgentId)
    const existing = jobs.find((job) => job.name === name)
    const message = buildCronPrompt({
      workspace: options.workspace,
      baseUrl: options.baseUrl,
      agent,
      project: options.project,
    })
    const args = existing
      ? [
          "cron",
          "edit",
          existing.id,
          "--name",
          name,
          "--agent",
          agent.AgentId,
          "--message",
          message,
          "--session",
          "isolated",
          "--timeout-seconds",
          "1800",
          "--enable",
          ...options.schedule.args,
        ]
      : [
          "cron",
          "add",
          "--name",
          name,
          "--agent",
          agent.AgentId,
          "--message",
          message,
          "--session",
          "isolated",
          "--timeout-seconds",
          "1800",
          ...options.schedule.args,
        ]

    const { stdout } = await execFileAsync(openclaw, args, {
      cwd: options.workspace,
      maxBuffer: 1024 * 1024,
    })
    const jobId = existing?.id ?? extractCronJobId(stdout)
    installed.push({
      agentId: agent.AgentId,
      name,
      schedule: options.schedule.label,
      jobId,
    })
    console.log(
      `${existing ? "Updated" : "Created"} OpenClaw cron job: ${name}${jobId ? ` (${jobId})` : ""}`
    )
  }

  return installed
}

async function findOpenClawBinary() {
  const configured = process.env.OPENCLAW_BIN
  if (configured) return configured

  try {
    await execFileAsync("openclaw", ["--version"])
    return "openclaw"
  } catch {
    throw new Error(
      "OpenClaw cron CLI is unavailable. Install OpenClaw or set OPENCLAW_BIN, then rerun init; no HEARTBEAT.md fallback was written."
    )
  }
}

type CronListJob = { id: string; name?: string }

async function listOpenClawCronJobs(openclaw: string) {
  const { stdout } = await execFileAsync(
    openclaw,
    ["cron", "list", "--all", "--json"],
    {
      maxBuffer: 1024 * 1024,
    }
  )
  const data = JSON.parse(stdout) as { jobs?: CronListJob[] }
  return data.jobs ?? []
}

function extractCronJobId(output: string) {
  const match = output.match(
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i
  )
  return match?.[0]
}

function buildCronPrompt(options: {
  workspace: string
  baseUrl: string
  agent: AgentBridgeAgent
  project: ConfigProject
}) {
  const projectLine = options.project.id
    ? `- Project ID: ${options.project.id}`
    : "- Project ID: use the configured/default AgentBridge project when needed"
  const repoLine = options.project.repository
    ? `- Repository: ${options.project.repository}`
    : "- Repository: inspect the workspace configuration or task notes when needed"

  return `You are ${options.agent.name}, ${options.agent.position} for the AgentBridge project.

This is your recurring AgentBridge project work loop. Check assigned work and make progress only when there is something actionable.

AgentBridge context:
- Base URL: ${options.baseUrl}
- Project name: ${options.project.name}
${projectLine}
${repoLine}
- OpenClaw workspace: ${options.workspace}
- Your AgentId: ${options.agent.AgentId}

Required behavior:
1. Load .openclaw/agentbridge/.env for AGENTBRIDGE_BASE_URL and AGENTBRIDGE_COMPANY_TOKEN if runtime env is missing. Never print, paste, commit, or store the token outside that local env file.
2. Use the agent-ops skill and AgentBridge /api/agent API with Authorization: Bearer <company-token> and AgentId: ${options.agent.AgentId}.
3. List assigned tasks with GET /api/agent/tasks and work only on tasks assigned to ${options.agent.AgentId}.
4. Prioritize blocked tasks you can unblock, then inprogress, then todo. Stay quiet if there is no actionable change.
5. For implementation work, clone/pull the repository if needed, read AGENTS.md before editing, follow existing style/architecture, and avoid unrelated rewrites.
6. Mark a task inprogress only when actually starting work. Mark finished work done with a concise note/summary that includes changed files, branch/commit/PR when relevant, and check results. Mark blocked with a clear blockingReason.
7. Create follow-up tasks in the same AgentBridge project only when low-risk and clearly implied; otherwise ask Natsuki/main or Vann.
8. Run relevant checks when practical: pnpm lint, pnpm typecheck, pnpm build, CLI build/pack for CLI changes, and report exact failures.
9. If SaaS production-readiness/audit work is requested or evidence suggests a broad production concern, trigger/coordinate with the SaaS audit task owner before broad changes.
10. Notify humans only on meaningful changes, blockers, failures, or completed work. If nothing changed and no action is needed, reply exactly: NO_REPLY`
}

async function readConfig(workspace: string): Promise<Config | null> {
  const filePath = path.join(
    workspace,
    ".openclaw",
    "agentbridge",
    "config.json"
  )
  if (!(await pathExists(filePath))) return null
  return JSON.parse(await readFile(filePath, "utf8")) as Config
}

async function readEnv(workspace: string) {
  const filePath = path.join(workspace, ".openclaw", "agentbridge", ".env")
  const values = new Map<string, string>()
  if (!(await pathExists(filePath))) return values

  for (const line of (await readFile(filePath, "utf8")).split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (!match) continue
    values.set(match[1], match[2].replace(/^"|"$/g, ""))
  }

  return values
}

async function resolveConnection(
  flags: Map<string, string | boolean>,
  workspace: string
) {
  const config = await readConfig(workspace)
  const envFile = await readEnv(workspace)
  const baseUrl =
    flagString(flags, "base-url") ??
    process.env.AGENTBRIDGE_BASE_URL ??
    envFile.get("AGENTBRIDGE_BASE_URL") ??
    config?.baseUrl
  const token =
    flagString(flags, "token") ??
    process.env.AGENTBRIDGE_COMPANY_TOKEN ??
    envFile.get("AGENTBRIDGE_COMPANY_TOKEN")
  const agentId =
    flagString(flags, "agent") ??
    process.env.AGENTBRIDGE_AGENT_ID ??
    config?.agents[0]?.AgentId

  if (!baseUrl)
    throw new Error("Missing base URL. Pass --base-url or run openclaw init.")
  if (!token)
    throw new Error(
      "Missing company token. Pass --token, set AGENTBRIDGE_COMPANY_TOKEN, or run openclaw init."
    )
  if (!agentId)
    throw new Error("Missing AgentId. Pass --agent or run openclaw init.")

  return { baseUrl, token, agentId, config }
}

async function resolveInitInputs(flags: Map<string, string | boolean>) {
  const workspace = await detectWorkspace(flagString(flags, "workspace"))
  console.log(`OpenClaw workspace: ${workspace}`)

  const baseUrl =
    flagString(flags, "base-url") ??
    process.env.AGENTBRIDGE_BASE_URL ??
    (await prompt("AgentBridge base URL", "http://localhost:3000"))
  const token =
    flagString(flags, "token") ??
    process.env.AGENTBRIDGE_COMPANY_TOKEN ??
    (await promptSecret("AgentBridge company token"))
  if (!token) throw new Error("Company token is required.")

  const candidates = await detectLocalAgents(workspace, {
    includeGlobalAgents: !flags.has("workspace") || flags.has("all-detected"),
  })
  if (candidates.length > 0) {
    console.log(
      `Detected local OpenClaw candidates: ${candidates.map((candidate) => candidate.agentId).join(", ")}`
    )
  } else {
    console.log(
      "No local OpenClaw agents detected; manual AgentId fallback will be offered."
    )
  }

  const explicitAgentId = flagString(flags, "agent")
  const { agents, authenticatedAgentId } = await fetchAgentsWithFallback(
    baseUrl,
    token,
    [explicitAgentId, ...candidates.map((candidate) => candidate.agentId)]
  )
  console.log(`Authenticated to AgentBridge as ${authenticatedAgentId}.`)
  const matches = matchAgents(candidates, agents)
  const selectedAgents = await selectAgents(matches, agents, explicitAgentId)
  if (selectedAgents.length === 0) throw new Error("No agents selected.")

  return { workspace, baseUrl, token, selectedAgents }
}

async function runInit(flags: Map<string, string | boolean>) {
  const { workspace, baseUrl, token, selectedAgents } =
    await resolveInitInputs(flags)
  const project: ConfigProject = {
    id: flagString(flags, "project-id"),
    name:
      flagString(flags, "project-name") ??
      (await prompt("AgentBridge project name", "AgentBridge")),
    repository:
      flagString(flags, "repo") ??
      (await prompt(
        "Project repository URL",
        "https://github.com/Vann-Dev/AgentBridge"
      )),
  }

  await installProjectInit({
    workspace,
    baseUrl,
    token,
    agents: selectedAgents,
    project,
    schedule: normalizeSchedule(flags),
    dryRun: flags.has("dry-run"),
    yes: flags.has("yes"),
  })
}

async function runAgentSetup(flags: Map<string, string | boolean>) {
  const { workspace, baseUrl, token, selectedAgents } =
    await resolveInitInputs(flags)
  await installAgentSetup({
    workspace,
    baseUrl,
    token,
    agents: selectedAgents,
    dryRun: flags.has("dry-run"),
    yes: flags.has("yes"),
  })
}

async function runDoctor(flags: Map<string, string | boolean>) {
  const workspace = await detectWorkspace(flagString(flags, "workspace"))
  const { baseUrl, token, agentId, config } = await resolveConnection(
    flags,
    workspace
  )
  const data = await requestJson<{
    agent: AgentBridgeAgent & { company?: { name: string } }
  }>({ baseUrl, token, agentId, pathname: "/api/agent" })

  console.log("AgentBridge doctor passed.")
  console.log(`  Base URL: ${baseUrl}`)
  console.log(`  Company: ${data.agent.company?.name ?? "unknown"}`)
  console.log(
    `  Agent: ${data.agent.AgentId} (${data.agent.name}, ${data.agent.position})`
  )
  console.log(
    `  Configured agents: ${config?.agents.map((agent) => agent.AgentId).join(", ") || "not configured"}`
  )

  const skillPath = config?.skillPath
    ? path.join(workspace, config.skillPath)
    : path.join(workspace, "skills", "agent-ops", "SKILL.md")
  console.log(
    `  Skill file: ${(await pathExists(skillPath)) ? "present" : "missing"} (${skillPath})`
  )
}

async function runCheck(flags: Map<string, string | boolean>) {
  const workspace = await detectWorkspace(flagString(flags, "workspace"))
  const { baseUrl, token, agentId } = await resolveConnection(flags, workspace)
  const data = await requestJson<{
    tasks: {
      id: string
      name: string
      status: string
      blockingReason?: string | null
    }[]
  }>({
    baseUrl,
    token,
    agentId,
    pathname: "/api/agent/tasks",
  })
  const priority = { blocked: 0, inprogress: 1, todo: 2, done: 3 } as Record<
    string,
    number
  >
  const tasks = [...data.tasks].sort(
    (a, b) =>
      (priority[a.status] ?? 9) - (priority[b.status] ?? 9) ||
      a.name.localeCompare(b.name)
  )

  console.log(`Tasks for ${agentId}: ${tasks.length}`)
  for (const task of tasks.slice(0, 20)) {
    console.log(
      `  [${task.status}] ${task.name} (${task.id})${task.blockingReason ? ` - ${task.blockingReason}` : ""}`
    )
  }
}

async function runStatus(flags: Map<string, string | boolean>) {
  const workspace = await detectWorkspace(flagString(flags, "workspace"))
  const config = await readConfig(workspace)
  if (!config) {
    console.log(
      `No AgentBridge OpenClaw config found in ${workspace}. Run openclaw init first.`
    )
    return
  }

  const envPath = path.join(workspace, ".openclaw", "agentbridge", ".env")
  const envStat = existsSync(envPath) ? await stat(envPath) : null
  console.log(`Workspace: ${workspace}`)
  console.log(`Base URL: ${config.baseUrl}`)
  console.log(
    `Agents: ${config.agents.map((agent) => `${agent.AgentId} (${agent.name})`).join(", ")}`
  )
  console.log(`Skill: ${config.skillPath}`)
  console.log(`Project: ${config.project?.name ?? "not configured"}`)
  console.log(
    `Cron jobs: ${config.cronJobs?.map((job) => `${job.agentId}${job.jobId ? ` (${job.jobId})` : ""}`).join(", ") || "not configured"}`
  )
  if (config.heartbeatFile)
    console.log(`Legacy heartbeat: ${config.heartbeatFile}`)
  console.log(
    `Secret env: ${envStat ? `present mode ${(envStat.mode & 0o777).toString(8)}` : "missing"}`
  )
}

async function main() {
  const rawArgs = process.argv.slice(2)
  if (rawArgs[0] === "--") rawArgs.shift()
  const { positional, flags } = parseArgs(rawArgs)
  if (flags.has("help") || positional.length === 0) {
    usage()
    return
  }

  const [scope, command, subcommand] = positional
  if (scope === "init") await runInit(flags)
  else if (
    scope === "agent" &&
    ["setup", "add", "link"].includes(command ?? "")
  ) {
    await runAgentSetup(flags)
  } else if (scope === "openclaw") {
    if (command === "init") await runInit(flags)
    else if (
      command === "agent" &&
      ["setup", "add", "link"].includes(subcommand ?? "")
    ) {
      await runAgentSetup(flags)
    } else if (command === "doctor") await runDoctor(flags)
    else if (command === "check" || command === "tasks") await runCheck(flags)
    else if (command === "status") await runStatus(flags)
    else {
      usage()
      process.exitCode = 1
    }
  } else {
    usage()
    process.exitCode = 1
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`AgentBridge CLI error: ${redact(message)}`)
  process.exitCode = 1
})
