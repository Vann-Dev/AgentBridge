# AgentBridge PR merge workflow

AgentBridge development uses AgentBridge tasks for coordination and GitHub pull requests for code review and merge decisions.

## Default path: task -> branch -> PR -> QA -> merge

1. **Coordinate in AgentBridge.** Work should start from an assigned AgentBridge task. Move the task to `inprogress` before making implementation changes and keep blockers or handoff notes on the task.
2. **Use a focused branch.** Create a branch named for the task or PR purpose. Keep commits focused and use Conventional Commit messages.
3. **Open a GitHub PR.** The PR is the source of truth for code review and merge readiness. Include a concise summary, changed areas, and test/check results.
4. **Request Ume QA.** Ume records the PR branch and commit reviewed, the checks run, and a clear `PASS` or `BLOCKED` result in AgentBridge. If QA blocks, fix the same PR branch or document the blocker and create narrowly scoped follow-up work when appropriate.
5. **Natsuki merges after gates pass.** Natsuki/main owns merge orchestration unless Vann explicitly directs otherwise. The normal merge path is through the PR, not direct pushes to `main`.

## Merge gates

Before Natsuki merges a PR, verify these gates where they apply:

- PR is open, non-draft, and cleanly mergeable against current `main`.
- Ume QA is `PASS` for the current PR head/merge-relevant commit, or Natsuki explicitly records why a fresh QA rerun is unnecessary.
- Relevant local checks pass, typically `corepack pnpm lint`, `corepack pnpm typecheck`, and `corepack pnpm build` with safe placeholder or QA `DATABASE_URL`/`AUTH_SECRET` values when required.
- Non-Vercel GitHub Actions and Docker checks pass when present and relevant.
- No unresolved security, migration, auth, dependency, or production-risk concerns remain.

Per Vann's current policy, **Vercel red/failing deployment checks are not merge blockers** for normal AgentBridge PRs because deployment is moving to Docker/GHCR. Treat Vercel output as diagnostic only unless Vann or Natsuki says a specific Vercel check is required for that PR.

## Direct-to-main exception

Direct-to-main is a fast-lane exception, not the default workflow. It may be used only for urgent, small, low-risk production hotfixes after:

- Vann or Natsuki approves the exception.
- Ume QA passes the exact commit being merged or the exact low-risk change is otherwise explicitly accepted.
- Relevant checks pass and are recorded.
- The task note records the commit, reason for bypassing PR flow, and validation performed.

Do **not** use direct-to-main for monorepo/repository structure work, Prisma migrations, auth/security changes, billing, dependency upgrades, large refactors, infra/deploy architecture, or any change where review history and rollback context need the PR trail.

## Recording manual merges and closures

When a branch is merged, closed, superseded, or manually reconciled, record the outcome in both GitHub and AgentBridge:

- Add or update the AgentBridge task note with the PR URL, branch, head/merge commit, changed files or scope, check results, QA status, and who merged or closed it.
- If a PR is closed without merge, leave a PR comment or task note explaining why it was superseded, abandoned, or replaced.
- If a branch is manually merged or conflict-resolved outside the normal squash path, record the final commit SHA and any conflict-resolution decisions.
- If Vercel remains red but is ignored under the Docker/GHCR policy, say so explicitly so later reviewers do not re-open the same blocker.

These notes are part of the project audit trail. Keep them concise, factual, and free of secrets.
