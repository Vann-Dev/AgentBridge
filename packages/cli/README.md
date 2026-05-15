# AgentBridge CLI

OpenClaw-first CLI for installing AgentBridge task coordination into an OpenClaw workspace.

After publish, the intended project setup usage is:

```bash
npx agentbridge-ai init --every 1h
```

The CLI installs AgentBridge instructions/config for OpenClaw agents and creates or updates OpenClaw cron jobs so agents can check assigned work on a recurring schedule. `agentbridge openclaw init` remains a compatibility alias for project setup.

## Commands

```bash
agentbridge init [--workspace <path>] [--base-url <url>] [--project-id <id>] [--project-name <name>] [--repo <url>] [--agent <AgentId>] [--every <duration>|--cron <expr>] [--tz <iana>] [--dry-run] [--yes]
agentbridge agent setup [--workspace <path>] [--base-url <url>] [--agent <AgentId>] [--all-detected] [--dry-run] [--yes]
agentbridge openclaw init [same as agentbridge init]
agentbridge openclaw doctor [--workspace <path>] [--base-url <url>] [--token <token>] [--agent <AgentId>]
agentbridge openclaw check [--workspace <path>] [--base-url <url>] [--token <token>] [--agent <AgentId>]
agentbridge openclaw status [--workspace <path>]
```

## Local development

From the AgentBridge repository root:

```bash
corepack pnpm --filter agentbridge-ai dev -- init --every 1h
corepack pnpm --filter agentbridge-ai dev -- agent setup --agent kaito
corepack pnpm --filter agentbridge-ai build
corepack pnpm --filter agentbridge-ai pack:dry-run
```

Before publish, test the built package locally:

```bash
corepack pnpm --filter agentbridge-ai build
node packages/cli/dist/index.js openclaw status --workspace ~/.openclaw
```

## Project init vs agent setup

`agentbridge init` is the initial/project owner flow:

1. Detects the OpenClaw workspace.
2. Detects local OpenClaw agent candidates.
3. Fetches company agents from `/api/agent/agents`.
4. Matches by `AgentId` or normalized name.
5. Asks for confirmation before writing files.
6. Creates or updates OpenClaw cron jobs named `AgentBridge <AgentId> project worker`.

The default schedule is hourly (`--every 1h`). Use `--every 15m`, `--every 1d`, or `--cron "0 9 * * *" --tz Asia/Jakarta` to override it.

`agentbridge agent setup` is the separate new-agent/linking flow. It confirms or links an AgentBridge AgentId and installs local config/skill files, but it does not create or overwrite project cron jobs.

Manual AgentId entry is fallback only.

The project installer writes:

- `skills/agent-ops/SKILL.md`
- `.openclaw/agentbridge/config.json` for non-secret config, project metadata, and cron job ids when available
- `.openclaw/agentbridge/.env` for `AGENTBRIDGE_BASE_URL` and `AGENTBRIDGE_COMPANY_TOKEN`, with `0600` permissions where supported
- OpenClaw cron jobs for recurring AgentBridge checks

The CLI no longer edits `HEARTBEAT.md` for recurring checks. If OpenClaw cron control is unavailable, project init fails clearly and does not silently fall back to heartbeat edits.

## Token safety

The CLI redacts tokens in errors and never prints the company token during normal command output. Do not commit generated `.openclaw/agentbridge/.env` files.
