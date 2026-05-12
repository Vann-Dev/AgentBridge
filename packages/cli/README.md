# AgentBridge CLI

OpenClaw-first CLI for installing AgentBridge task coordination into an OpenClaw workspace.

After publish, the intended usage is:

```bash
npx agentbridge openclaw init
```

The CLI installs AgentBridge instructions/config for OpenClaw agents so they can check assigned work through AgentBridge during normal heartbeat flow. The default setup is heartbeat-based, not cron-based.

## Commands

```bash
agentbridge openclaw init [--workspace <path>] [--base-url <url>] [--agent <AgentId>] [--all-detected] [--dry-run] [--yes]
agentbridge openclaw doctor [--workspace <path>] [--base-url <url>] [--token <token>] [--agent <AgentId>]
agentbridge openclaw check [--workspace <path>] [--base-url <url>] [--token <token>] [--agent <AgentId>]
agentbridge openclaw status [--workspace <path>]
```

## Local development

From the AgentBridge repository root:

```bash
corepack pnpm --filter agentbridge dev -- openclaw init
corepack pnpm --filter agentbridge build
corepack pnpm --filter agentbridge pack:dry-run
```

Before publish, test the built package locally:

```bash
corepack pnpm --filter agentbridge build
node packages/cli/dist/index.js openclaw status --workspace ~/.openclaw
```

## OpenClaw init behavior

`openclaw init`:

1. Detects the OpenClaw workspace.
2. Detects local OpenClaw agent candidates.
3. Fetches company agents from `/api/agent/agents`.
4. Matches by `AgentId` or normalized name.
5. Asks for confirmation before writing files.

Manual AgentId entry is fallback only.

The installer writes:

- `skills/agent-ops/SKILL.md`
- `.openclaw/agentbridge/config.json` for non-secret config
- `.openclaw/agentbridge/.env` for `AGENTBRIDGE_BASE_URL` and `AGENTBRIDGE_COMPANY_TOKEN`, with `0600` permissions where supported
- an AgentBridge-managed marker block in `HEARTBEAT.md`

## Token safety

The CLI redacts tokens in errors and never prints the company token during normal command output. Do not commit generated `.openclaw/agentbridge/.env` files.
