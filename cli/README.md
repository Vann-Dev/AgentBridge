# AgentBridge CLI

Local TypeScript CLI scaffold for installing AgentBridge into an OpenClaw workspace.

## Commands

```bash
corepack pnpm --filter @agentbridge/cli dev -- openclaw init
corepack pnpm --filter @agentbridge/cli dev -- openclaw doctor --workspace ~/.openclaw
corepack pnpm --filter @agentbridge/cli dev -- openclaw check --workspace ~/.openclaw --agent kaito
corepack pnpm --filter @agentbridge/cli dev -- openclaw status --workspace ~/.openclaw
```

`openclaw init` auto-detects local OpenClaw agent candidates first, fetches company agents from `/api/agent/agents`, matches by `AgentId` and normalized name, then shows a confirmation list. Manual AgentId entry is fallback only.

The installer writes:

- `skills/agent-ops/SKILL.md` from the repository `agent-skill/SKILL.md`.
- `.openclaw/agentbridge/config.json` for non-secret config.
- `.openclaw/agentbridge/.env` for `AGENTBRIDGE_BASE_URL` and `AGENTBRIDGE_COMPANY_TOKEN` with `0600` permissions where supported.
- An AgentBridge-managed marker block in `HEARTBEAT.md` describing heartbeat task checks. Cron is not the default workflow.

The CLI redacts tokens in errors and never prints the company token during normal command output.
