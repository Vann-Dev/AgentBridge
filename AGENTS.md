# AGENTS.md

## Project Overview

- AgentBridge is a Next.js App Router project using React 19, TypeScript, Tailwind CSS v4, shadcn/ui, Prisma 7, and PostgreSQL.
- The app is a dashboard for managing companies, agents, projects, and tasks.
- Authentication uses a JWT stored in the `agentbridge_session` HTTP-only cookie.
- `AUTH_SECRET` is required for signing/verifying sessions.
- `DATABASE_URL` is required for Prisma/PostgreSQL access.
- Prisma client output is generated into `generated/prisma`.

## API Routes

- API routes must be created under the Next.js App Router API path: `app/api/**/route.ts`.
- API routes that start with `/api/agent` are used for agent interactions and are protected by the custom `agentAuth` middleware that checks for a valid bearer token in the `Authorization` header.
- API routes that start with `/api/internal` are used for dashboard interactions and are protected by a custom `auth` middleware that checks for a valid JWT in the `agentbridge_session` cookie.
- API JSON responses must include a `statusCode` field that matches the HTTP status code, including error responses.
- API error responses should use the shape `{ statusCode: number, error: string }`.
- Agent APIs must never expose bearer tokens or `bearerTokenHash` values.
- When adding or changing `/api/agent/**` API routes, update the OpenAPI JSDoc comments beside the route handler so `GET /api/openapi` and `GET /api/swagger` stay accurate.
- OpenAPI docs are generated with `swagger-jsdoc`; include concrete schemas for `200` responses, not only descriptions.
- Only `/api/agent/**` routes should appear in Swagger/OpenAPI docs; do not document `/api/internal/**` dashboard routes there.
- When an `/api/agent/**` response shape changes, update matching schemas in `app/api/openapi/route.ts` and ensure the `apis` glob includes the route file.

## UI Rules

- Always use shadcn/ui components for reusable UI elements when a shadcn component exists.
- If a shadcn component is missing, add it through the shadcn workflow instead of hand-rolling a parallel component.
- Keep the existing visual language: rounded cards, muted surfaces, Tailwind utility classes, and dashboard shell/sidebar patterns.
- Prefer small, direct component changes over new abstractions unless reuse is clear.

## Security Notes

- Do not commit `.env` or secrets.
- The seeded admin credentials are shown on the login page; keep this local/dev only unless the product explicitly wants public demo credentials.
- Agent bearer tokens are shown only once by design; only SHA-256 hashes are stored.

## Docker And CI

- Docker builds use `pnpm` through Corepack and should run `pnpm prisma generate` before `pnpm build`.
- Docker images must include the generated Prisma client from `generated/prisma` because Prisma client output is not under `node_modules`.
- Build containers should provide harmless placeholder `AUTH_SECRET` and `DATABASE_URL` values because Next.js/Prisma code can read env vars during production builds.
- Runtime containers should receive the real `AUTH_SECRET` and `DATABASE_URL` through environment variables, not copied `.env` files.
- The app container should run `prisma migrate deploy` before starting Next.js so PostgreSQL schema is ready.
- Next.js must bind to `0.0.0.0` inside Docker so the mapped host port can reach it.
- Docker Compose should use PostgreSQL with a healthcheck and make the app depend on the healthy database service.
- GitHub release Docker builds push to GitHub Container Registry (`ghcr.io`) using the repository name lowercased.
- Release image tags should include the release tag, semver tags when applicable, and `latest`.

## Git And GitHub

- Use Conventional Commits for commit messages: `type(scope): summary`.
- Prefer these commit types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, and `revert`.
- Keep commit summaries imperative, lowercase after the type, and under 72 characters when practical.
- Use a scope when it adds useful context, such as `api`, `auth`, `dashboard`, `docker`, `ci`, `prisma`, or `ui`.
- Use `feat` only for user-visible new capability; use `fix` for bug fixes, `build` for build system/dependency changes, and `ci` for GitHub Actions/workflow changes.
- Add a commit body when the why or risk is not obvious; wrap body lines near 72 characters.
- Mark breaking changes with `!` in the header and a `BREAKING CHANGE:` footer.
- Do not commit `.env`, secrets, generated build output, `node_modules`, `.next`, coverage, or local logs.
- Before committing, inspect `git status` and `git diff` so unrelated user changes are not accidentally included.
- Keep commits focused; split unrelated changes into separate commits.
- Run relevant checks before pushing when practical, especially `pnpm lint`, `pnpm typecheck`, and `pnpm build` for app changes.
- Do not bypass hooks with `--no-verify` unless explicitly approved.
- Do not amend, rebase, force-push, or rewrite shared history unless explicitly requested and the risk is understood.
- Pull requests should have a concise title, a summary of user-facing or operational impact, test notes, and linked issues when relevant.
- For release PRs or tags, ensure Docker/GitHub Actions changes align with the `Docker And CI` rules above.
