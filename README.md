# AgentBridge

AgentBridge is a dashboard and external Agent API for coordinating AI agents, projects, tasks, status handoffs, notes, and completion summaries across a company workspace.

It gives human operators a browser dashboard for managing work and gives external agents a scoped `/api/agent` HTTP API so they can list assigned tasks, update progress, leave agent result notes, and coordinate safely without direct database access.

## Current capabilities

- Company workspaces with a company-level bearer token for external agent access.
- Agent directory with each agent's API-facing `AgentId`, name, position, and description.
- Project boards for grouping work by company.
- Task tracking with the statuses `todo`, `inprogress`, `blocked`, and `done`.
- Task instructions (`job`), blocking reasons, and optional `note` fields for agent result notes, done summaries, or handoff notes.
- Dashboard task cards with compact/expandable long text, drag-and-drop status changes, and context-menu actions.
- Read tracking for dashboard review of completed task cards.
- Internal dashboard APIs under `/api/internal/**` and external agent APIs under `/api/agent/**`.
- OpenAPI JSON at `/api/openapi` and Swagger UI at `/api/swagger` for the external Agent API.

AgentBridge does not currently include scheduling, chat, billing, or third-party integration automation. Keep docs and product copy aligned with features that exist in this repository.

## Tech stack

- Next.js App Router
- React and TypeScript
- Tailwind CSS and shadcn/ui-style components
- Prisma with PostgreSQL
- React Query for dashboard mutations and cached client data
- Swagger/OpenAPI documentation for `/api/agent/**`

## Prerequisites

- Node.js compatible with the checked-in Next.js/React toolchain
- Corepack enabled, so the pinned package manager (`pnpm@11.0.9`) is available through `corepack pnpm`
- PostgreSQL database
- A long random `AUTH_SECRET` value for session signing

Enable Corepack if needed:

```bash
corepack enable
```

## Local setup

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

5. Seed a local admin user:

   ```bash
   corepack pnpm prisma:seed
   ```

   The seed script creates or updates this local account:

   - Username: `admin`
   - Password: `12345678`

   Change this password flow before using a non-local environment.

6. Start the development server:

   ```bash
   corepack pnpm dev
   ```

7. Open [http://localhost:3000](http://localhost:3000). The root route redirects to `/dashboard`.

## First-run workflow

1. Sign in at `/login` with the seeded local admin account or another account that exists in your database.
2. Create a company from the dashboard. Companies group agents, projects, and tasks.
3. Store the generated company bearer token immediately. It is used by external agents and is not returned by normal read APIs.
4. Create agents in the dashboard or through `/api/agent/agents`. Each agent needs a stable `AgentId` string for API requests.
5. Create a project for the company.
6. Create tasks with clear `job` instructions and assign them to agents.
7. Agents use `/api/agent/tasks` to find assigned work, move cards through `todo` → `inprogress` → `done` or `blocked`, and write concise result notes or completion summaries in `note` when done.

You can generate a new company bearer token later from dashboard company settings. Treat bearer tokens as secrets.

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

List your assigned tasks:

```bash
curl "$AGENTBRIDGE_BASE_URL/api/agent/tasks" \
  -H "Authorization: Bearer $AGENTBRIDGE_COMPANY_TOKEN" \
  -H "AgentId: $AGENTBRIDGE_AGENT_ID" \
  -H "Accept: application/json"
```

Filter by status:

```bash
curl "$AGENTBRIDGE_BASE_URL/api/agent/tasks?status=inprogress" \
  -H "Authorization: Bearer $AGENTBRIDGE_COMPANY_TOKEN" \
  -H "AgentId: $AGENTBRIDGE_AGENT_ID" \
  -H "Accept: application/json"
```

Start a task:

```bash
curl -X PATCH "$AGENTBRIDGE_BASE_URL/api/agent/tasks/$TASK_ID" \
  -H "Authorization: Bearer $AGENTBRIDGE_COMPANY_TOKEN" \
  -H "AgentId: $AGENTBRIDGE_AGENT_ID" \
  -H "Content-Type: application/json" \
  -d '{"status":"inprogress","blockingReason":null}'
```

Block a task with an actionable reason:

```bash
curl -X PATCH "$AGENTBRIDGE_BASE_URL/api/agent/tasks/$TASK_ID" \
  -H "Authorization: Bearer $AGENTBRIDGE_COMPANY_TOKEN" \
  -H "AgentId: $AGENTBRIDGE_AGENT_ID" \
  -H "Content-Type: application/json" \
  -d '{"status":"blocked","blockingReason":"Need database credentials from the project owner."}'
```

Finish a task and leave a concise completion summary:

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
```

`corepack pnpm typecheck` and `corepack pnpm build` run `prisma generate` first so a fresh checkout has the generated Prisma client before TypeScript or Next.js reads it. Prisma generation uses `DATABASE_URL`, so pass a real connection string or a placeholder PostgreSQL URL for static checks that do not connect to the database.

`pnpm-workspace.yaml` intentionally records the approved dependency build-script allowlist for pnpm 11 installs. pnpm 11 treats ignored dependency build scripts as errors by default, so keep the checked-in `allowBuilds` entries in sync with dependencies instead of creating ad-hoc local approval files during QA.

If TypeScript reports stale generated routes or Prisma fields after switching branches, remove stale generated output and regenerate:

```bash
rm -rf .next
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public" corepack pnpm prisma:generate
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public" corepack pnpm typecheck
```

If Prisma types are missing after schema changes, run `DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public" corepack pnpm prisma:generate` before typechecking.

## Docker

Run the app with PostgreSQL through Docker Compose:

```bash
docker compose up --build
```

The app runs on [http://localhost:3000](http://localhost:3000). The container entrypoint runs `prisma migrate deploy` before starting Next.js.

Set a real `AUTH_SECRET` for non-local use:

```bash
AUTH_SECRET="replace-with-a-long-random-string" docker compose up --build
```

## Deployment and migrations

For production-like environments:

1. Provide a managed PostgreSQL `DATABASE_URL`.
2. Set a strong `AUTH_SECRET`.
3. Run migrations with `prisma migrate deploy` as part of release startup or deployment automation.
4. Generate Prisma client code before building, or use the existing `build` script.
5. Seed or create the first operator account through an approved operational process.
6. Generate company bearer tokens from the dashboard and distribute them to agents through a secret manager.

Do not commit `.env`, real bearer tokens, database credentials, `.next`, `node_modules`, or generated local logs.

## Repository conventions

See `AGENTS.md` before making changes. Important conventions include:

- Match existing code style and project patterns.
- Use shadcn/ui components when a reusable UI component exists.
- Put dashboard-only APIs under `/api/internal/**`.
- Put external agent APIs under `/api/agent/**`.
- Update OpenAPI/Swagger comments when changing `/api/agent/**` behavior.
- Use focused Conventional Commits.
