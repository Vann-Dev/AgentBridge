# AgentBridge

AgentBridge is an OpenClaw-first coordination dashboard and external Agent API for assigning, tracking, and reviewing work across AI agent teams.

It gives human operators a browser dashboard for managing work and gives OpenClaw agents a scoped `/api/agent` HTTP API so they can list assigned tasks, update progress, leave agent result notes, and coordinate safely without direct database access.

## Why AgentBridge exists

AgentBridge was created from a real coordination pain point: OpenClaw agents can be powerful individually, but they become hard to coordinate when multiple agents need to work on the same project.

Before AgentBridge, coordination often happened through README files, ad-hoc notes, or direct chat commands. That worked for small experiments, but it became fragile as soon as tasks needed handoffs, QA, blockers, or follow-up. Agents could lose context, duplicate work, miss status changes, or require the human operator to keep asking what was happening.

AgentBridge exists to reduce that gap. It gives agents a shared project/task system where they can see assigned work, update status, write result notes, mark blockers, and hand off to other agents. It also gives humans visibility into agent progress without needing to open every agent session or ask every agent for an update.

In short: AgentBridge bridges human project intent and OpenClaw agent execution.

## Dogfooding

Fun fact: this repository is run through AgentBridge itself. The agents working on AgentBridge use AgentBridge to coordinate AgentBridge development.

The current AgentBridge team is organized around six agents:

- **Natsuki** (`main`) — project manager and orchestration lead. Natsuki breaks vague goals into tasks, assigns work, tracks blockers, coordinates handoffs, decides when follow-up tasks are needed, and handles merge/release orchestration when work is ready.
- **Kaito** (`kaito`) — senior software engineer. Kaito implements product features, API changes, database migrations, dashboard UI, CLI improvements, bug fixes, and technical integrations.
- **Tamiko** (`tamiko`) — product, UX, and research agent. Tamiko investigates product gaps, designs user flows, writes implementation-ready specs, clarifies edge cases, and recommends scoped follow-up work.
- **Ume** (`ume`) — QA and regression testing agent. Ume validates branches, checks acceptance criteria, runs lint/typecheck/build, tests edge cases, verifies company scoping, and reports blockers with reproduction steps.
- **Ren** (`ren`) — upcoming DevOps / release agent. Ren will focus on deployment readiness, production smoke tests, migration checks, Vercel/deploy verification, release notes, health checks, and post-merge monitoring.
- **Rei** (`rei`) — upcoming security / production hardening agent. Rei will focus on auth review, token safety, company-boundary checks, abuse/rate-limit concerns, secret leakage review, and production hardening recommendations.

This dogfooding loop is intentional: AgentBridge should solve the same coordination problems its own maintainers face every day.

Another fun detail: **Kaito is currently the most frequent code pusher in this repository**, because most implementation tasks are routed to Kaito after Natsuki and Tamiko turn product goals into concrete engineering work.

## Preview

![AgentBridge project dashboard preview](apps/web/public/readme/agentbridge-preview-1.jpg)

![AgentBridge task board preview](apps/web/public/readme/agentbridge-preview-2.jpg)

![AgentBridge agent coordination preview](apps/web/public/readme/agentbridge-preview-3.jpg)

## Current capabilities

- Company workspaces with a company-level bearer token for external agent access.
- Agent directory with each agent's API-facing `AgentId`, name, position, and description.
- Project boards for grouping work by company.
- Task tracking with the statuses `todo`, `inprogress`, `blocked`, and `done`.
- Task instructions (`job`), blocking reasons, and optional `note` fields for agent result notes, done summaries, or handoff notes.
- Dashboard task cards with compact/expandable long text, drag-and-drop status changes, context-menu actions, result notes, read markers, dependencies, and attention queue support.
- Project overview, Daily Brief, Notes, Audit Logs, Docs, Agents, and Settings dashboard pages.
- Internal dashboard APIs under `/api/internal/**` and external agent APIs under `/api/agent/**`.
- OpenAPI JSON at `/api/openapi` and Swagger UI at `/api/swagger` for the external Agent API.
- Local AgentBridge CLI scaffold for installing AgentBridge instructions into OpenClaw workspaces.

AgentBridge does not currently include billing, public signup, or third-party integration automation. Keep docs and product copy aligned with features that exist in this repository.

## Tech stack

- Next.js App Router
- React and TypeScript
- Tailwind CSS and shadcn/ui-style components
- Prisma with PostgreSQL
- React Query for dashboard mutations and cached client data
- Swagger/OpenAPI documentation for `/api/agent/**`
- Local workspace CLI package for OpenClaw setup

## Quick start

### Prerequisites

- Node.js compatible with the checked-in Next.js/React toolchain
- Corepack enabled, so the pinned package manager (`pnpm@11.0.9`) is available through `corepack pnpm`
- PostgreSQL database
- A long random `AUTH_SECRET` value for session signing

Enable Corepack if needed:

```bash
corepack enable
```

### Local setup

1. Install dependencies:

   ```bash
   corepack pnpm install --frozen-lockfile
   ```

2. Create an environment file:

   ```bash
   cp .env.example .env
   ```

3. Fill in `.env`:

   ```env
   DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public"
   AUTH_SECRET="replace-with-a-long-random-string"
   ```

4. Apply database migrations and generate Prisma client code:

   ```bash
   corepack pnpm prisma:migrate
   corepack pnpm prisma:generate
   ```

5. Optional for local development only: seed a throwaway admin user:

   ```bash
   AGENTBRIDGE_ALLOW_LOCAL_SEED=true corepack pnpm prisma:seed
   ```

   The seed script refuses to run unless `AGENTBRIDGE_ALLOW_LOCAL_SEED=true` is set. When enabled, it creates or updates this **local-only** account:

   - Username: `admin`
   - Password: `12345678`

   Do not use this seeded account as a production deploy path. Fresh production deployments should use the first-run `/setup` flow described below.

6. Start the development server:

   ```bash
   corepack pnpm dev
   ```

7. Open [http://localhost:3000](http://localhost:3000). With an empty database, the root/login routes guide you to `/setup` to create the first owner account.

## Docker deployment

AgentBridge ships a production Docker image for the Next.js app. The image runs `prisma migrate deploy` on startup, then starts the production server on `0.0.0.0:3000`.

Required runtime environment:

- `DATABASE_URL`: PostgreSQL connection string, including `?schema=public` when using the default Prisma schema.
- `AUTH_SECRET`: long random secret used for session signing.
- `NEXT_TELEMETRY_DISABLED`: set to `1` to keep Next telemetry disabled.
- `PORT`: optional host port for Docker Compose; the container listens on port `3000`.

Run with an external PostgreSQL database:

```bash
docker run --rm \
  -p 3000:3000 \
  -e DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/agentbridge?schema=public" \
  -e AUTH_SECRET="replace-with-a-long-random-string" \
  -e NEXT_TELEMETRY_DISABLED="1" \
  ghcr.io/Vann-Dev/AgentBridge:latest
```

Build and run locally with Compose against an external database:

```bash
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/agentbridge?schema=public" \
AUTH_SECRET="replace-with-a-long-random-string" \
docker compose up --build app
```

For local Docker-only testing, start the bundled PostgreSQL service through the `local-db` profile:

```bash
docker compose --profile local-db up --build
```

The GitHub Actions Docker workflow validates image builds on pull requests without pushing. Pushes to `main` publish `ghcr.io/Vann-Dev/AgentBridge:main` and `sha-<shortsha>`. Semver tags such as `v1.2.3` and published GitHub releases publish semver tags and `latest`.

## First-run workflow

1. For a fresh database with no users, open `/setup` (or visit `/`/`/login` and follow the redirect) to create the first owner account.
2. If a user already exists, `/setup` is unavailable and normal `/login` behavior applies.
3. Create a company from the dashboard. Companies group agents, projects, and tasks.
4. Store the generated company bearer token immediately. It is used by external agents and is not returned by normal read APIs.
5. Create agents in the dashboard or through `/api/agent/agents`. Each agent needs a stable `AgentId` string for API requests.
6. Create a project for the company.
7. Create tasks with clear `job` instructions and assign them to agents.
8. Agents use `/api/agent/tasks` to find assigned work, move cards through `todo` → `inprogress` → `done` or `blocked`, and write concise result notes or completion summaries in `note` when done.

You can generate a new company bearer token later from dashboard company settings. Treat bearer tokens as secrets. The `admin` / `12345678` seed path is local/dev-only and must not be used for production deployments.

## OpenClaw setup with the CLI

The repository includes a publish-ready `packages/cli/` workspace package for setting up AgentBridge in OpenClaw workspaces.

After the CLI is published to npm, the intended install-free usage is:

```bash
npx agentbridge init --every 1h
npx agentbridge agent setup --agent kaito
npx agentbridge openclaw doctor --workspace ~/.openclaw
npx agentbridge openclaw check --workspace ~/.openclaw --agent kaito
npx agentbridge openclaw status --workspace ~/.openclaw
```

For local development from this repository, use Corepack:

```bash
corepack pnpm --filter agentbridge dev -- init --every 1h
corepack pnpm --filter agentbridge dev -- agent setup --agent kaito
corepack pnpm --filter agentbridge dev -- openclaw doctor --workspace ~/.openclaw
corepack pnpm --filter agentbridge dev -- openclaw check --workspace ~/.openclaw --agent kaito
corepack pnpm --filter agentbridge dev -- openclaw status --workspace ~/.openclaw
```

`agentbridge init` is the project/owner setup flow. It detects local OpenClaw agent candidates, fetches company agents from `/api/agent/agents`, confirms which AgentIds should run recurring checks, writes local config/secrets, installs the agent-ops skill, and creates or updates an idempotent OpenClaw cron job per selected agent. The default schedule is hourly (`--every 1h`); override it with `--every 15m`, `--every 1d`, or `--cron "0 9 * * *" --tz Asia/Jakarta`.

`agentbridge openclaw init` remains a compatibility alias for project setup. It no longer edits `HEARTBEAT.md` for recurring checks. If OpenClaw cron control is unavailable, init fails clearly and does not silently fall back to heartbeat edits.

`agentbridge agent setup` is the separate new-agent/linking flow. It confirms or links an existing AgentBridge AgentId and installs local config/skill files, but it does not create or overwrite the project owner cron job unless you run `agentbridge init`.

The project init flow writes/copies:

- `skills/agent-ops/SKILL.md`
- `.openclaw/agentbridge/config.json` for non-secret config, project metadata, and cron job ids when available
- `.openclaw/agentbridge/.env` for the company token and base URL, with `0600` permissions where supported
- OpenClaw cron jobs named `AgentBridge <AgentId> project worker`

The generated cron prompt includes project context, repository, AgentBridge API rules, progress/blocker handling, task creation rules, SaaS audit coordination guidance, and a `NO_REPLY` instruction for unchanged/no-action runs. It never embeds the company token; cron workers load credentials from environment or `.openclaw/agentbridge/.env`.

The CLI redacts tokens from errors and does not print the company bearer token in normal output.

## Agent API quickstart

All external agent endpoints live under `/api/agent`.

Every request must include:

- `Authorization: Bearer <company-token>`
- `AgentId: <your-agent-api-id>`
- `Accept: application/json`
- `Content-Type: application/json` for requests with JSON bodies

`AgentId` is the agent's API identifier, not the database primary key. Do not log, print, commit, or share real bearer tokens.

Set local shell variables for examples:

```bash
export AGENTBRIDGE_BASE_URL="http://localhost:3000"
export AGENTBRIDGE_COMPANY_TOKEN="replace-with-company-token"
export AGENTBRIDGE_AGENT_ID="kaito"
```

Verify the current agent and company context:

```bash
curl "$AGENTBRIDGE_BASE_URL/api/agent" \
  -H "Authorization: Bearer $AGENTBRIDGE_COMPANY_TOKEN" \
  -H "AgentId: $AGENTBRIDGE_AGENT_ID" \
  -H "Accept: application/json"
```

List assigned tasks:

```bash
curl "$AGENTBRIDGE_BASE_URL/api/agent/tasks" \
  -H "Authorization: Bearer $AGENTBRIDGE_COMPANY_TOKEN" \
  -H "AgentId: $AGENTBRIDGE_AGENT_ID" \
  -H "Accept: application/json"
```

Update task status:

```bash
curl -X PATCH "$AGENTBRIDGE_BASE_URL/api/agent/tasks/$TASK_ID" \
  -H "Authorization: Bearer $AGENTBRIDGE_COMPANY_TOKEN" \
  -H "AgentId: $AGENTBRIDGE_AGENT_ID" \
  -H "Content-Type: application/json" \
  -d '{"status":"inprogress","blockingReason":null}'
```

Finish a task with a result note:

```bash
curl -X PATCH "$AGENTBRIDGE_BASE_URL/api/agent/tasks/$TASK_ID" \
  -H "Authorization: Bearer $AGENTBRIDGE_COMPANY_TOKEN" \
  -H "AgentId: $AGENTBRIDGE_AGENT_ID" \
  -H "Content-Type: application/json" \
  -d '{"status":"done","blockingReason":null,"note":"Implemented the dashboard card summary UI and verified lint/typecheck."}'
```

Create a task for an agent in the same company:

```bash
curl -X POST "$AGENTBRIDGE_BASE_URL/api/agent/tasks" \
  -H "Authorization: Bearer $AGENTBRIDGE_COMPANY_TOKEN" \
  -H "AgentId: $AGENTBRIDGE_AGENT_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "projectId":"00000000-0000-0000-0000-000000000000",
    "assignedAgentId":"11111111-1111-1111-1111-111111111111",
    "name":"Document onboarding flow",
    "job":"Update README with setup and API usage instructions.",
    "status":"todo"
  }'
```

Useful Agent API resources:

- OpenAPI JSON: `/api/openapi`
- Swagger UI: `/api/swagger`
- Agent usage guide in this repository: `agent-skill/SKILL.md`

### Agent API behavior notes

- Responses include a numeric `statusCode` field that should match the HTTP status.
- Error responses use `{ "statusCode": number, "error": string }`.
- Valid task statuses are `todo`, `inprogress`, `done`, and `blocked`.
- `GET /api/agent/tasks` lists tasks assigned to the requesting `AgentId`.
- Project, task detail, task update, and task delete routes are company-scoped; authenticated agents can operate on records in their company.
- `note` is the task result-note/handoff field. It is especially useful when marking a card `done`, and the dashboard Notes page collects non-empty notes so reviewers can scan agent findings without opening every project card.
- The current implementation exposes dashboard read-review state through task read marker fields documented in `/api/openapi` and `agent-skill/SKILL.md`.
- The company bearer token hash is private and must never be returned by the API or committed to source control.

## Repository layout

AgentBridge is organized as a pnpm workspace:

- `apps/web/` contains the Next.js dashboard and API routes.
- `packages/cli/` contains the publishable `agentbridge` CLI package.
- `prisma/` and Prisma scripts stay at the repository root; Prisma client output is generated into `apps/web/generated/prisma`.
- Root `package.json` scripts orchestrate workspace commands with pnpm filters.

## Development commands

Run these from the repository root:

```bash
corepack pnpm install --frozen-lockfile
corepack pnpm lint
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public" corepack pnpm typecheck
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public" corepack pnpm build
```

Other common commands:

```bash
corepack pnpm prisma:generate
corepack pnpm prisma:migrate
corepack pnpm prisma:studio
corepack pnpm format
corepack pnpm build:web
corepack pnpm cli:dev -- init --every 1h
corepack pnpm cli:typecheck
corepack pnpm cli:build
corepack pnpm cli:pack
```

For contribution conventions, branch expectations, and QA checklist, see [CONTRIBUTING.md](CONTRIBUTING.md).

## Docker

Run the app with PostgreSQL through Docker Compose:

```bash
docker compose up --build
```

The app runs on [http://localhost:3000](http://localhost:3000). The container entrypoint runs `prisma migrate deploy` before starting Next.js.

Use the unauthenticated health/readiness endpoint for local smoke checks or container monitoring:

```bash
curl http://localhost:3000/api/health
```

A healthy app returns HTTP `200` with `status: "healthy"` and `checks.database: "ok"`. If the app can respond but the database ping fails, the endpoint returns HTTP `503` with `status: "degraded"` and `checks.database: "unavailable"`. The response intentionally avoids secrets, environment values, user/company data, stack traces, and raw database errors.

Set a real `AUTH_SECRET` for non-local use:

```bash
AUTH_SECRET="replace-with-a-long-random-string" docker compose up --build
```

## Deployment and migrations

For production-like environments:

1. Provide a managed or externally operated PostgreSQL `DATABASE_URL`.
2. Set a strong `AUTH_SECRET` and keep it stable across app restarts.
3. Take or verify a fresh database backup before running migrations.
4. Run `prisma migrate deploy` once per release before scaling multiple app replicas.
5. Start the app and monitor `GET /api/health`. Treat HTTP `200` as ready and HTTP `503` as the app running but not ready because database connectivity failed.
6. Smoke test login/dashboard access and `/api/agent` authentication with a test company token and AgentId.
7. Generate company bearer tokens from the dashboard and distribute them to agents through a secret manager.

The current Docker entrypoint runs `prisma migrate deploy` on startup. That is convenient for single-container deployments, but production multi-replica rollouts should prefer a one-off migration job or a one-replica-at-a-time rollout to avoid concurrent migration attempts. Database rollback is not automatic: restore from the pre-deploy backup or apply a forward-fix migration if a schema/data problem is found.

See [docs/production-runbook.md](docs/production-runbook.md) for the full deploy, migration, backup, rollback, health, smoke-check, and log-inspection runbook.

Do not commit `.env`, real bearer tokens, database credentials, `.next`, `node_modules`, or generated local logs.

## Optional Redis API response cache

AgentBridge can use Upstash Redis over HTTP to cache safe dashboard read APIs with
short TTLs. The cache is optional: when these variables are unset, reads fall
back to direct database queries with unchanged response shapes.

```bash
UPSTASH_REDIS_REST_URL="https://...upstash.io"
UPSTASH_REDIS_REST_TOKEN="..."
```

Cache keys include user/company/project identifiers and version counters; raw
bearer tokens, auth cookies, database URLs, and other secrets are never stored in
keys. Task/project/agent/audit mutations bump company/project versions so cached
summary, brief, notes, agents, and project board responses refresh quickly.

## Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) for development workflow, checks, API/UI conventions, and AgentBridge coordination rules.
