# Production deployment runbook

This runbook covers the minimal production operating path for AgentBridge SaaS deployments: required environment, database backups, migrations, application startup, rollback caveats, smoke checks, and log inspection.

## Scope and assumptions

- Use a managed or externally operated PostgreSQL database for production.
- Treat `docker-compose.yml` and its bundled `db` service as a local development or small self-host reference only. It is not a complete production database operations plan unless you add external backups, monitoring, restore drills, disk management, and access controls.
- The production Docker image starts the Next.js web app and currently runs `prisma migrate deploy` in `docker-entrypoint.sh` before starting the server.
- The app listens on container port `3000` and exposes an unauthenticated readiness endpoint at `GET /api/health`.

## Required environment

Set these runtime variables for the web app or container:

| Variable | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL` | Yes | PostgreSQL connection string. Include `?schema=public` unless using a different Prisma schema intentionally. Use a production database user with only the privileges the app needs. |
| `AUTH_SECRET` | Yes | Long random secret for session signing. Keep stable across app restarts; rotating it invalidates existing sessions. |
| `NEXT_TELEMETRY_DISABLED` | Recommended | Set to `1` in production images and runtime. |
| `PORT` | Optional | Host-side Compose port. The container listens on `3000`. |

Do not print, commit, or paste real database credentials, company bearer tokens, token hashes, `AUTH_SECRET`, `.env` files, or production logs containing secrets into issues or agent tasks.

## Pre-deploy checklist

1. Confirm the release artifact or image tag you are deploying.
2. Confirm the target database and environment are correct.
3. Confirm `DATABASE_URL` and `AUTH_SECRET` are present in the runtime secret store.
4. Take or verify a fresh database backup before running migrations.
5. Review pending Prisma migrations for destructive operations or long-running locks.
6. Ensure only one migration runner will execute for the release.
7. Have rollback steps ready: previous app image/tag, backup location, and operator access.

## Database backup

Before every production migration:

1. Trigger a provider snapshot or logical backup for the production PostgreSQL database.
2. Record the backup identifier, timestamp, environment, and release/image tag being deployed.
3. Confirm the backup completed successfully before migration starts.
4. Prefer periodic restore drills in a separate database so backup validity is tested before an incident.

Example logical backup shape for self-managed PostgreSQL:

```bash
pg_dump "$DATABASE_URL" --format=custom --file="agentbridge-$(date -u +%Y%m%dT%H%M%SZ).dump"
```

Store backups outside the app container and outside the primary database volume. Protect them with the same or stronger access controls as production data.

## Migration deploy

Prisma migrations are applied with:

```bash
corepack pnpm prisma migrate deploy
```

The Docker image runs the equivalent startup step through `docker-entrypoint.sh`:

```sh
pnpm prisma migrate deploy
```

### Preferred production pattern

Run migrations as a single one-off job before starting or rolling out multiple app replicas:

```bash
docker run --rm \
  -e DATABASE_URL="$DATABASE_URL" \
  -e AUTH_SECRET="$AUTH_SECRET" \
  ghcr.io/Vann-Dev/AgentBridge:<tag> \
  pnpm prisma migrate deploy
```

Then start or roll the web app containers:

```bash
docker run --rm \
  -p 3000:3000 \
  -e DATABASE_URL="$DATABASE_URL" \
  -e AUTH_SECRET="$AUTH_SECRET" \
  -e NEXT_TELEMETRY_DISABLED="1" \
  ghcr.io/Vann-Dev/AgentBridge:<tag>
```

### Current limitation: startup migrations

Because the current image entrypoint always runs `prisma migrate deploy`, every app container attempts the migration step at startup. This is acceptable for a single-container deployment and usually harmless when no migrations are pending, but it is not the safest multi-replica rollout pattern.

For multi-replica production deployments, avoid migration races by ensuring only one instance starts with the migration-capable entrypoint at a time, or by using platform controls/entrypoint overrides to run a dedicated migration job before scaling the web app. If your platform cannot separate migrations from app startup, document that limitation in the release notes and roll out one replica at a time.

### Legacy pre-token database upgrades

The migration chain has a compatibility path for older non-empty AgentBridge databases that existed before company-scoped bearer tokens and stable `AgentId` values were introduced. Historical token migrations backfill deterministic placeholder values so `prisma migrate deploy` can complete instead of failing on required non-null columns.

After upgrading a legacy pre-token database:

1. Sign in to the dashboard.
2. Review agents and rename any generated `legacy-<uuid>` AgentIds to the intended stable API identifiers before configuring external agents.
3. Rotate the company bearer token in Settings and update external agent configs with the newly shown token. The migration placeholders are not usable plaintext bearer tokens.
4. Run the Agent API smoke check with the intended `AgentId` and new company token.

## App start

For Docker Compose with an external database:

```bash
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/agentbridge?schema=public" \
AUTH_SECRET="replace-with-a-long-random-string" \
docker compose up --build app
```

For the local bundled PostgreSQL reference only:

```bash
docker compose --profile local-db up --build
```

Do not use the bundled Compose database as production unless you have added and tested backups, monitoring, restore, upgrades, and storage operations.

## Post-deploy smoke checks

Run these checks after migrations and app startup.

### 1. Health/readiness

```bash
curl -i https://<host>/api/health
```

Expected ready response:

- HTTP `200`
- JSON `statusCode: 200`
- JSON `status: "healthy"`
- JSON `checks.app: "ok"`
- JSON `checks.database: "ok"`

Expected degraded response when the app can answer but the database check fails:

- HTTP `503`
- JSON `statusCode: 503`
- JSON `status: "degraded"`
- JSON `checks.database: "unavailable"`

The health response intentionally omits secrets, environment values, user/company data, stack traces, and raw database errors.

### 2. Login and dashboard

1. Visit `/login`.
2. Sign in with an existing operator account or complete the approved first-owner setup flow for a fresh database if enabled in the deployed version.
3. Confirm `/dashboard` loads.
4. Open Projects and one project board.
5. Confirm task cards, Notes, Audit Logs, Docs, Agents, and Settings pages load as expected for the selected company.

### 3. Agent API authentication

Use a test company token and AgentId from the target company. Never paste real tokens into shared logs.

```bash
curl "$AGENTBRIDGE_BASE_URL/api/agent" \
  -H "Authorization: Bearer $AGENTBRIDGE_COMPANY_TOKEN" \
  -H "AgentId: $AGENTBRIDGE_AGENT_ID" \
  -H "Accept: application/json"
```

Expected response:

- HTTP `200`
- JSON `statusCode: 200`
- `agent.AgentId` matches the requested agent
- `agent.company` matches the intended company

Then list assigned tasks:

```bash
curl "$AGENTBRIDGE_BASE_URL/api/agent/tasks" \
  -H "Authorization: Bearer $AGENTBRIDGE_COMPANY_TOKEN" \
  -H "AgentId: $AGENTBRIDGE_AGENT_ID" \
  -H "Accept: application/json"
```

Expected response:

- HTTP `200`
- JSON `statusCode: 200`
- `tasks` is an array scoped to the authenticated company and requesting agent.

## Log inspection

Inspect platform/container logs for:

- Migration start/completion from `prisma migrate deploy`.
- Next.js app startup on `0.0.0.0:3000`.
- Repeated `GET /api/health` failures or HTTP `503` responses.
- Authentication failures that may indicate wrong company token or AgentId.
- Database connection timeouts or pool exhaustion.

Examples:

```bash
docker compose logs app
docker logs <container-id>
```

For managed platforms, use the provider's deployment logs and runtime logs. Do not copy logs containing secrets or raw credentials into public channels.

## Rollback and restore caveats

Application rollback and database rollback are separate operations.

- Rolling back the app image to a previous tag does not roll back database migrations.
- Prisma does not provide automatic production migration rollback.
- If a migration causes bad schema/data state, choose between:
  - restoring the database from the pre-deploy backup, or
  - applying a forward-fix migration/code patch.
- Restoring a database reverts data to the backup timestamp and can lose writes made after that backup.
- Coordinate downtime or write freezes before restore when data loss risk matters.

Minimum rollback procedure:

1. Stop or pause new app rollout.
2. Decide whether app-only rollback is safe with the current schema.
3. If app-only rollback is safe, deploy the previous known-good image/tag and run smoke checks.
4. If database restore is required, stop writers, restore the chosen backup, deploy a compatible app version, and rerun smoke checks.
5. Record the incident, root cause, release tag, migration names, and follow-up fixes.

## Release record template

```text
Release:
Image/tag:
Commit:
Database backup id:
Migration command/result:
Deployed by:
Started at:
Completed at:
Health check: 200/503 details
Login/dashboard smoke: pass/fail
Agent API smoke: pass/fail
Rollback plan:
Notes/follow-ups:
```
