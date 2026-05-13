# Contributing to AgentBridge

Thanks for helping improve AgentBridge. This project is developed with the same multi-agent coordination workflow that AgentBridge is built to support.

## Development workflow

1. Read `AGENTS.md` before making changes.
2. Keep changes focused and scoped to one feature, fix, or documentation improvement.
3. Prefer small branches with clear acceptance criteria.
4. Update docs and OpenAPI comments when changing `/api/agent/**` behavior.
5. Do not commit secrets, bearer tokens, `.env`, `.next`, `node_modules`, local logs, or generated private config.

## Branches and commits

Use focused Conventional Commit-style messages, for example:

```bash
feat(dashboard): add project brief page
fix(api): validate duplicate AgentId errors
docs(readme): clarify OpenClaw setup
```

## Checks before submitting

Run these from the repository root before opening or merging a pull request:

```bash
corepack pnpm install --frozen-lockfile
corepack pnpm lint
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public" corepack pnpm typecheck
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public" corepack pnpm build
```

The `typecheck` and `build` scripts run `prisma generate` first. If you are only doing static checks, a placeholder PostgreSQL-shaped `DATABASE_URL` is usually enough.

If TypeScript reports stale generated routes or Prisma fields after switching branches, clear generated output and regenerate:

```bash
rm -rf .next
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public" corepack pnpm prisma:generate
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public" corepack pnpm typecheck
```

## Database changes

- Use Prisma migrations for schema changes.
- Keep migrations safe for existing data whenever possible.
- Document any required production migration or backfill steps in the task/PR notes.
- Avoid destructive migrations unless the project owner explicitly approves them.

Common commands:

```bash
corepack pnpm prisma:generate
corepack pnpm prisma:migrate
corepack pnpm prisma:studio
```

## API conventions

- Dashboard-only reads and mutations should use Server Actions or server-component loaders. Do not add new `/api/internal/**` routes for dashboard-only flows.
- External agent APIs belong under `/api/agent/**`.
- Agent API requests must use the company bearer token and an `AgentId` header.
- Never log, print, or expose bearer tokens.
- Keep company scoping explicit on all database reads/writes.
- API errors should use `{ "statusCode": number, "error": string }` where practical.

## UI conventions

- Match existing dashboard patterns and components.
- Use shadcn/ui-style components when an existing reusable component is available.
- Preserve responsive layouts and compact task-card behavior.
- Add loading, empty, and error states for data-heavy dashboard pages.

## AgentBridge coordination

When this repository is managed through AgentBridge:

- Product/design/research tasks usually go to Tamiko.
- Implementation tasks usually go to Kaito.
- QA/regression tasks usually go to Ume.
- Orchestration, merge, and release coordination usually go through Natsuki (`main`).

Task notes should include branch, commit, changed files, checks run, and QA handoff details when relevant.
