# AGENTS.md

## Project Workflow

- Before working on the project, read the relevant project files first to understand how things are done.
- Reuse the existing code style, patterns, naming, layout, and project conventions.
- Prefer matching nearby code over introducing a new approach.


## AgentBridge Merge Workflow

- Default to the PR-based workflow documented in `docs/agentbridge-merge-workflow.md`: AgentBridge task, focused branch, GitHub PR, Ume QA, then Natsuki/main merge.
- Treat GitHub PRs as the source of truth for code review and merge readiness; AgentBridge remains the coordination tracker and audit trail.
- Per Vann policy, Vercel red/failing deployment checks are not normal merge blockers while deployment is moving to Docker/GHCR; use PR cleanliness, non-Vercel GitHub Actions/Docker checks, local lint/typecheck/build, and AgentBridge QA PASS instead.
- Use direct-to-main only as an explicit urgent hotfix exception after approval, exact-commit QA/checks, and task-note documentation. Never use it for monorepo/repo structure, migrations, auth/security, billing, dependency upgrades, large refactors, or infra/deploy architecture.
- Record manual branch merges, closures, superseded PRs, ignored Vercel failures, and final commit SHAs in task notes and/or PR comments so future agents can audit the decision.

## Frontend

- Always use shadcn/ui components for reusable UI elements when a shadcn component exists.
- If a shadcn component is missing, add it through the shadcn workflow instead of hand-rolling a parallel component.
- Keep the existing visual language: rounded cards, muted surfaces, Tailwind utility classes, and dashboard shell/sidebar patterns.
- Prefer small, direct component changes over new abstractions unless reuse is clear.

## API Routes and Dashboard Actions

- Use Server Actions and server-component loaders for dashboard and in-app usage. Do not create new `/api/internal/**` routes for dashboard-only flows.
- Always create agent/external-use APIs under `/api/agent/**`.
- Agent APIs are for agent usage outside the app.
- API routes must use the Next.js App Router route format under `app/api/**/route.ts`.
- Agent API route files should live under `app/api/agent/**/route.ts`.
- Always use OpenAPI and Swagger documentation for `/api/agent/**` routes.
- Only `/api/agent/**` routes should appear in OpenAPI/Swagger docs.
- Do not document dashboard Server Actions or any internal-only route in OpenAPI/Swagger.
- When adding or changing `/api/agent/**` routes, update the OpenAPI JSDoc comments beside the route handler.
- Add concrete JSON response examples to Swagger/OpenAPI for `/api/agent/**` routes.
- Use `app/api/agent/agents/route.ts` as the example pattern for agent API docs.
- When changing `app/api/agent/**/route.ts`, include the JSON response example directly in that route's Swagger/OpenAPI JSDoc.

## Commits

- Use Conventional Commits for commit messages: `type(scope): summary`.
- Prefer these commit types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, and `revert`.
- Keep commit summaries imperative, lowercase after the type, and under 72 characters when practical.
- Use a scope when it adds useful context, such as `api`, `auth`, `dashboard`, `docker`, `ci`, `prisma`, or `ui`.
- Use `feat` only for user-visible new capability.
- Use `fix` for bug fixes.
- Use `build` for build system or dependency changes.
- Use `ci` for GitHub Actions or workflow changes.
- Add a commit body when the why or risk is not obvious.
- Wrap commit body lines near 72 characters.
- Mark breaking changes with `!` in the header and a `BREAKING CHANGE:` footer.
- Do not commit `.env`, secrets, generated build output, `node_modules`, `.next`, coverage, or local logs.
- Before committing, inspect `git status` and `git diff` so unrelated user changes are not accidentally included.
- Keep commits focused.
- Split unrelated changes into separate commits.
- Run relevant checks before pushing when practical, especially `pnpm lint`, `pnpm typecheck`, and `pnpm build` for app changes.
- Do not bypass hooks with `--no-verify` unless explicitly approved.
- Do not amend, rebase, force-push, or rewrite shared history unless explicitly requested and the risk is understood.
- Pull requests should have a concise title, a summary of user-facing or operational impact, test notes, and linked issues when relevant.
- For release PRs or tags, ensure Docker/GitHub Actions changes align with the Docker and CI rules used by the project.
