# Production SaaS smoke and regression checklist

Use this checklist before a production SaaS release or after changes touching authentication, company scoping, Agent API routes, task cards, deployment, or dashboard navigation.

Do not paste real bearer tokens, database URLs, passwords, session cookies, or customer data into notes, screenshots, logs, or bug reports. Use a disposable company, agents, projects, and tasks for manual verification.

## Safe test data setup

- Use a disposable admin account or an approved QA owner account.
- Create a disposable company named like `QA Smoke <date>`.
- Create at least three agents in that company:
  - `main` / Natsuki-style reviewer.
  - `ume` / QA agent.
  - `kaito` / implementation agent.
- Store the generated company bearer token only in a local secret store or shell variable; never commit or paste it.
- Create a disposable project with task cards covering:
  - Short task instructions.
  - Long multiline task instructions.
  - A blocked task with `blockingReason`.
  - A done task with a long multiline `note` summary.
  - A task whose note is edited after it was marked read.

## Checklist

### 1. Fresh database first-run setup

Steps:
- Start the app against an empty PostgreSQL database with a valid `AUTH_SECRET`.
- Apply migrations and generate the Prisma client.
- Seed only when validating local/dev behavior; do not rely on seed credentials in production.
- Visit `/dashboard` and `/login`.

Expected pass observations:
- Migrations apply cleanly.
- The app does not expose stack traces or secrets on first load.
- Without a valid session, protected dashboard routes redirect to login.
- After login, a user with no company is guided to create/select a company.
- Creating the first company succeeds and shows the one-time bearer token recovery path clearly.

Fail observations to file:
- Migration failure, missing generated client, blank page, leaked env value, unusable no-company state, or inability to create the first company.

Automation candidate:
- Route tests for unauthenticated redirects, no-company dashboard state, and company creation validation.

### 2. Seeded/local-dev behavior

Steps:
- Run the documented seed command in a local-only database.
- Log in with documented local credentials.
- Create company, agents, project, and tasks.

Expected pass observations:
- Seed is idempotent for local/dev.
- README clearly labels seed credentials as local-only.
- Local setup commands match the current repo layout.

Fail observations to file:
- Seed mutates production-like data unexpectedly, docs point to old monorepo paths, or local login no longer works.

Automation candidate:
- Seed script smoke test against an isolated disposable database.

### 3. Login throttle and auth audit

Steps:
- Submit several invalid login attempts for an existing user and for a nonexistent user.
- Then submit valid credentials.
- Review dashboard audit logs where available.

Expected pass observations:
- Invalid attempts are throttled or delayed according to the implemented protection.
- Error messages do not reveal whether a username exists.
- Valid login works after the safe throttle window/limit behavior.
- Audit events are company/user scoped where applicable and do not include raw passwords, hashes, session secrets, bearer tokens, env values, stack traces, or huge request bodies.

Fail observations to file:
- User enumeration, no throttle on repeated failures, valid users locked out permanently, or secret-bearing audit details.

Automation candidate:
- Auth route tests for invalid login responses, throttle boundary, and audit detail redaction.

### 4. Company scoping and dashboard isolation

Steps:
- Create two companies under the same owner or use two approved QA companies.
- In each company, create separate agents, projects, and tasks.
- Switch companies from the dashboard sidebar/header.
- Try internal route calls with IDs from the other company while the active company differs.

Expected pass observations:
- Project, agent, task, notes, audit, and settings views show only the active company data.
- Internal APIs reject cross-company IDs with a safe error.
- Company switch invalidates/refetches dashboard summary, projects, agents, and task data.
- No stale task/project data remains visible after switching.

Fail observations to file:
- Cross-company data appears, mutations affect the wrong company, stale summaries persist, or deletion/rename targets the wrong company.

Automation candidate:
- Internal API integration tests for every company-scoped route using two companies.

### 5. Agent API authentication and scoping

Steps:
- Call `/api/agent` and `/api/agent/tasks` with:
  - No bearer token.
  - Wrong bearer token.
  - Correct token but missing/unknown `AgentId`.
  - Correct token and valid `AgentId`.
- With a valid token, try reading/updating a task from another company.

Expected pass observations:
- Unauthorized requests return `{ statusCode: 401, error: "Unauthorized" }` and HTTP 401.
- Valid requests return only current-company data.
- `GET /api/agent/tasks` lists only tasks assigned to the requesting agent.
- Task detail/update/delete remain current-company scoped.
- Responses never include `bearerTokenHash` or raw bearer tokens.

Fail observations to file:
- HTTP/statusCode mismatch, unknown agent accepted, cross-company read/write, or secret/token leak.

Automation candidate:
- Agent API route tests for auth matrix and company boundary enforcement.

### 6. Task note, `summaryUpdatedAt`, and done summary behavior

Steps:
- Create a task with no note.
- Add a note while keeping status todo/inprogress.
- Mark a task done with a concise completion summary in `note`.
- Clear the note, then add a new note again.
- Compare internal API and `/api/agent/tasks` responses.

Expected pass observations:
- `note` is `null` or a trimmed string consistently.
- `summaryUpdatedAt` is `null` when there is no note.
- `summaryUpdatedAt` is set when a note is created or changed.
- Editing a note updates `summaryUpdatedAt`; resubmitting identical note text does not create unnecessary freshness churn.
- Done cards can carry both the summary and normal task metadata.
- Internal APIs and `/api/agent` APIs expose equivalent `note`, `summaryUpdatedAt`, `taskUpdatedAt`, updater metadata, `blockingReason`, and read-marker fields using documented names.

Fail observations to file:
- Missing field in one API, stale timestamp after edit, timestamp changes on no-op, note whitespace not trimmed, or summary lost on status change.

Automation candidate:
- Task create/update route tests for note timestamp transitions and response shape snapshots.

### 7. Natsuki/main read markers and unread identification

Steps:
- Ensure an agent with `AgentId: main` exists in the company.
- Create or update a done task with a non-empty note.
- Open `/dashboard/notes`.
- Mark the summary reviewed.
- Refresh the page and call the notes API again.

Expected pass observations:
- `/dashboard/notes` identifies Natsuki/main as the review reader when `main` exists.
- Unread done summaries are shown until reviewed.
- Marking reviewed creates or updates a done-status read marker for `main`.
- The card disappears from the unread queue after review and stays gone after refresh.
- Project task card read details show that `main` read the current done card.
- Read tracking is per task, per agent, and per status; a todo read marker does not make the done status read.

Fail observations to file:
- Already-read summaries reappear, read markers do not persist, wrong fallback reader is used despite `main` existing, or read state from another status is reused.

Automation candidate:
- Notes API tests for unread filtering, mark-reviewed persistence, and per-status marker isolation.

### 8. Summary changes after being read

Steps:
- Mark a done summary reviewed by Natsuki/main.
- Edit the same task note to different text without selecting readers.
- Reopen `/dashboard/notes`.
- Mark it reviewed again.

Expected pass observations:
- Editing the summary updates `summaryUpdatedAt`.
- Existing done-status read marker is cleared or treated stale so the card becomes unread again.
- Notes page clearly re-surfaces the changed summary.
- Re-review updates the read marker and removes the card from the unread queue again.

Fail observations to file:
- Changed summaries stay hidden as already read, read marker timestamp is newer than changed summary without review, or UI gives no clue why it reappeared.

Automation candidate:
- Integration test asserting `readAt < summaryUpdatedAt` causes unread classification.

### 9. Long text compaction and expandable text

Steps:
- Create tasks with long single-line and multiline `job`, `note`, and `blockingReason` values.
- View project board cards and the Notes page at desktop and narrow widths.
- Use "Show details", "Show more", and "Show less" controls.

Expected pass observations:
- Cards remain compact by default; long text does not make columns unusable.
- Summary/blocking previews are line-clamped or height-limited.
- Expanding details exposes full job, summary, blocking reason, and read marker details.
- Expand/collapse controls are discoverable, keyboard clickable, and do not trigger drag/drop or card context actions unexpectedly.
- Notes page long summaries are compact by default and expand clearly.

Fail observations to file:
- Text overflows horizontally, controls are missing for multiline text, expansion is unclear, click toggles cause unintended drag/context behavior, or narrow layout becomes unreadable.

Automation candidate:
- Component tests later for rendering long text and expansion state; visual regression screenshots if a UI test stack is approved.

### 10. Drag/drop status changes

Steps:
- Drag a task from todo to in progress, blocked, and done.
- Refresh after each move.
- Drag a task onto its current column.
- Try the same flow on a narrow/mobile viewport and verify a non-drag fallback exists through task update controls.

Expected pass observations:
- Status changes persist and update dashboard counts after refresh.
- Moving to a new status clears read markers for the destination status unless readers are explicitly selected later.
- Dragging to the same status is a no-op.
- Errors rollback optimistic UI changes and show a readable error.
- Mobile/narrow users can still change status through the update dialog even if drag/drop is impractical.

Fail observations to file:
- Status change does not persist, optimistic UI remains wrong after API failure, read markers incorrectly survive status change, or mobile users have no practical status-change path.

Automation candidate:
- Route tests for status update/read clearing; defer browser drag/drop automation until an approved E2E framework exists.

### 11. Context menu and task actions

Steps:
- Open a task card context menu.
- Use Update task to edit name, job, assignee, status, note, read markers, and blocking reason.
- Use Delete task on disposable data only.

Expected pass observations:
- Context menu opens reliably and does not conflict with expandable details.
- Update dialog saves valid fields and shows validation errors for invalid fields.
- Delete requires confirmation and removes only the selected task.
- Query invalidation refreshes project, dashboard summary, projects, and agents where relevant.

Fail observations to file:
- Wrong task opens/deletes, dialogs cannot be closed, mutation errors are hidden, or stale data remains after action.

Automation candidate:
- Internal API tests for update/delete validation; component/E2E tests later for menu flows.

### 12. Blocking reason and summary coexistence

Steps:
- Create or update a task with both `blockingReason` and `note` populated.
- Move it between blocked and done statuses.
- Read it through internal project API and `/api/agent/tasks`.

Expected pass observations:
- Both fields persist independently.
- Card preview can show blocking reason and done summary without one hiding/destructively overwriting the other.
- Clearing blocking reason does not clear note/summary, and clearing note does not clear blocking reason.

Fail observations to file:
- One field overwrites the other, only one API exposes both, or UI layout hides a high-impact blocking reason.

Automation candidate:
- Task update route tests for independent field transitions.

### 13. OpenAPI/Swagger documentation

Steps:
- Open `/api/openapi` and `/api/swagger`.
- Review `/api/agent/**` task schemas and examples.
- Confirm internal `/api/internal/**` routes are not documented.

Expected pass observations:
- Agent task docs include `note`, `summaryUpdatedAt`, `readBy`, `blockingReason`, dependency fields when present, `taskUpdatedAt`, and updater metadata consistently with actual responses.
- Request docs explain `readBy` as API `AgentId` values.
- Examples are concrete JSON and do not include secrets.
- Swagger UI loads from the generated OpenAPI JSON.

Fail observations to file:
- API shape changed but docs/examples are stale, docs mention internal routes, or examples include impossible fields as request inputs.

Automation candidate:
- Snapshot or schema smoke test for `/api/openapi` generation and documented route presence.

### 14. Token rotation and recovery

Steps:
- Create a company and save the initial token securely.
- Verify Agent API works with the old token.
- Rotate/regenerate the company bearer token in settings.
- Verify the old token fails and the new token works.
- Confirm dashboard copy explains one-time storage/recovery expectations.

Expected pass observations:
- Old token is invalid immediately after rotation.
- New token authenticates expected agents in the same company.
- No token hash or raw token is exposed by normal GET APIs.
- Audit/settings UI avoids logging raw token values.

Fail observations to file:
- Old token remains accepted, new token fails, token can be fetched later in plaintext, or token appears in audit/log output.

Automation candidate:
- Internal settings route tests for rotation invalidating old token and preserving scoping.

### 15. Company deletion safeguard

Steps:
- Attempt to delete/cancel company deletion with disposable data.
- Attempt deletion when multiple companies exist and when only one company exists, according to current product rules.
- Verify related projects/tasks/agents/audit behavior is intentional.

Expected pass observations:
- Destructive action requires explicit confirmation.
- UI copy states impact clearly.
- The app prevents or safely handles deleting the last required company, depending on product rules.
- After deletion, active company selection and dashboard routes recover without broken state.

Fail observations to file:
- Accidental one-click deletion, orphaned active company, cross-company deletion, or unrecoverable dashboard state.

Automation candidate:
- Internal company delete route tests for ownership, last-company rule, and post-delete active-company behavior.

### 16. Docker, migrations, and deploy smoke

Steps:
- Build the production app with deployment-equivalent env placeholders/secrets supplied safely.
- Build Docker image or run the documented Docker workflow where practical.
- Run migration deploy against disposable/prod-like database.
- Start the container/app and visit `/api/health`, `/login`, `/dashboard`, `/api/openapi`, and `/api/swagger`.

Expected pass observations:
- `pnpm build` succeeds.
- Prisma generate and migration deploy use correct paths for the current repo layout.
- Container starts without missing workspace files or generated client errors.
- Health endpoint returns non-secret JSON and appropriate status.
- Docs/CI workflow match current deployment assumptions.

Fail observations to file:
- Build fails, generated client missing, migration path broken, Docker image lacks needed files, or health endpoint leaks configuration.

Automation candidate:
- CI smoke for build, migration deploy dry run where safe, and Docker image build.

### 17. `/api/health`

Steps:
- Call `/api/health` with no auth.
- If the endpoint checks database readiness, test both normal DB access and a safe simulated DB failure in a disposable environment.

Expected pass observations:
- Response is fast and machine-readable.
- Healthy state returns HTTP 200.
- Degraded state returns an appropriate non-200 or documented degraded response.
- Response does not expose secrets, database URLs, stack traces, or internal token hashes.

Fail observations to file:
- Slow/hanging response, false healthy on DB failure, or secret-bearing error output.

Automation candidate:
- Route test with mocked DB success/failure.

### 18. Dashboard project and Daily Brief smoke

Steps:
- Open dashboard overview, Projects list, a project detail board, Notes page, Agents page, Audit Logs, Settings, and Daily Brief/brief dashboard if enabled.
- Create/update/archive done tasks on disposable data.
- Confirm counts and latest-note summaries update after mutations.

Expected pass observations:
- Navigation works without full-page errors.
- Dashboard summary counts match project/task state.
- Project list cards load quickly and link to the correct project.
- Brief/summary page handles empty, loading, and populated states.
- Archived done tasks disappear from active boards without deleting needed audit/history unexpectedly.

Fail observations to file:
- Broken navigation, stale counts, missing project cards, brief page crash, or archive action hides non-done work.

Automation candidate:
- Internal summary route tests and future lightweight E2E smoke for dashboard navigation.

### 19. Mobile/narrow layout readability

Steps:
- Use browser dev tools or a real device at ~360px and tablet widths.
- Review login, dashboard overview, projects, project board, task update dialog, notes, agents, audit logs, and settings.

Expected pass observations:
- Text wraps instead of overflowing horizontally.
- Dialogs fit and scroll correctly.
- Task columns stack/read sensibly.
- Buttons remain tappable and destructive confirmations are readable.
- Long note/blocking/job text remains compact until expanded.

Fail observations to file:
- Horizontal overflow, clipped controls, unreachable dialog footer, unreadable cards, or destructive controls too easy to tap accidentally.

Automation candidate:
- Future visual smoke screenshots at mobile and desktop once an approved browser test framework exists.

## Standard command checks

Run when repository files changed or before release sign-off:

```bash
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm build
```

If commands require environment values, load them from approved local secret files or CI secrets. Never paste those values into QA notes.

Expected pass observations:
- Lint exits 0.
- Typecheck exits 0.
- Build exits 0 and completes Prisma generate/Next build successfully.

Fail observations to file:
- Include command, sanitized error excerpt, branch/commit, and whether failure is related to the change under QA.

## Bug report template

- Severity: Critical / High / Medium / Low.
- Area: dashboard / internal API / Agent API / auth / deployment / docs.
- Reproduction steps: exact safe data setup and actions.
- Expected result.
- Actual result.
- Evidence: sanitized log excerpt, file/line, screenshot description, or response shape.
- Risk/impact.
- Recommended next step.
