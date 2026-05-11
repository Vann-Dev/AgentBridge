---
name: agent-ops
description: Agent Ops is the skill of managing and coordinating multiple agents to work together effectively. It involves assigning tasks, tracking progress, resolving conflicts, and ensuring that agents collaborate smoothly to achieve shared goals.
metadata:
  {
    "openclaw":
      {
        "always": true,
        "requires":
          { "env": ["AGENTBRIDGE_COMPANY_TOKEN", "AGENTBRIDGE_BASE_URL"] },
      },
  }
---

# AgentBridge Agent API Skill

Use this skill when acting as an external agent that needs to read or update work through the AgentBridge `/api/agent` HTTP API.

Repository path: `agent-skill/SKILL.md`.

## Core Rules

- All agent API paths are under `/api/agent`.
- Authenticate every request with the company token: `Authorization: Bearer <company-token>`.
- Identify the acting agent on every request with `AgentId: <your-agent-id>`.
- Always use your own known agent id as the `AgentId` header value.
- `AgentId` is the agent's stable API identifier, not necessarily the database primary key `id`.
- Never log, print, store, or expose the bearer token.
- Treat `Company.bearerTokenHash` as private; the API must never return it and agents must not ask for it.
- Read the `statusCode` field in every JSON response. It should match the HTTP status.
- Error shape is `{ "statusCode": number, "error": string }`.
- Valid task statuses are `todo`, `inprogress`, `done`, and `blocked`.
- `GET /api/agent/tasks` lists only tasks assigned to the current agent.
- Task detail, update, and delete endpoints are company-scoped: any authenticated agent can read, update, reassign, or delete tasks in the current company.
- Agent and project endpoints are company-scoped: they only read or mutate records from the authenticated company.
- Creating an agent requires a caller-provided unique `AgentId`; it does not create or return a bearer token.

## Base Request Shape

```bash
curl "$AGENTBRIDGE_BASE_URL/api/agent" \
  -H "Authorization: Bearer $AGENTBRIDGE_COMPANY_TOKEN" \
  -H "AgentId: <your-agent-id>" \
  -H "Accept: application/json"
```

Use `Content-Type: application/json` on requests with JSON bodies.

## Task Notes, Dependencies, and Read Markers

Tasks can include coordination fields in addition to the work instructions:

- `note`: optional string or `null`. Use this as the agent result note: concise findings, implementation note, completion summary, QA handoff, or status update. When marking a task `done`, include what changed, changed files/branch/commit/PR when relevant, and check results. Dashboard users can review non-empty notes from the Notes page as well as the source task card.
- `summaryUpdatedAt`: nullable timestamp showing when the `note`/summary was last set or changed. Treat it as freshness metadata for review/read-marker decisions.
- `readBy`: array of agent `AgentId` strings that have read the task in its **current status**. The underlying read tracking is per task, per agent, and per status. If `main` has read a task in `todo`, that does not mean `main` has read it in `done`; each status is independent.
- `dependencies`: compact task objects that must be `done` before this task is ready.
- `dependencyIds`: dependency task database UUIDs. Send this array on task create/update to set dependencies.
- `unblocks`: compact task objects that depend on this task.
- `isDependencyReady`: `true` when a task has dependencies and all dependencies are currently `done`.

`readBy` request behavior:

- On task create, optional `readBy` marks the listed agents as read for the initial status.
- On task update, optional `readBy` replaces the readers for the task's resulting/current status only.
- Omit `readBy` when changing status or note unless you intentionally want the current status to become unread; status/note changes without explicit readers clear read markers for the resulting status.
- `readBy` values are API `AgentId` strings, not database ids or timestamps.
- Task responses include compact freshness metadata: `taskUpdatedAt`, `taskUpdatedById`, `taskUpdatedByName`, and `taskUpdatedByType` (`agent`, `user`, or `system`). Agent API updates record the acting agent as the latest task updater.

Legacy hardcoded Natsuki-only read timestamps are not the public read-tracking API. Use `readBy`.

Dependency behavior:

- Dependencies must be active tasks in the same company/project.
- A task cannot depend on itself.
- Updates replace the full dependency list for that task when `dependencyIds` is provided.
- Cycles are rejected when practical, so agents should avoid dependency loops.

## Endpoints

### Get Current Agent

`GET /api/agent`

Returns the authenticated agent profile and company.

Response:

```json
{
  "statusCode": 200,
  "agent": {
    "id": "uuid",
    "AgentId": "agent-api-id",
    "name": "Agent Name",
    "description": "Agent description",
    "position": "Agent role",
    "companyId": "uuid",
    "company": {
      "id": "uuid",
      "name": "Company Name",
      "description": "Company description"
    }
  }
}
```

### List Company Agents

`GET /api/agent/agents`

Returns agents in the current agent's company, ordered by name.

Response:

```json
{
  "statusCode": 200,
  "agents": [
    {
      "id": "uuid",
      "AgentId": "agent-api-id",
      "name": "Agent Name",
      "description": "Agent description",
      "position": "Agent role",
      "_count": {
        "tasks": 3
      }
    }
  ]
}
```

### Create Company Agent

`POST /api/agent/agents`

Creates an agent in the current company. The caller must provide the unique `AgentId` that the new agent will send in the `AgentId` request header. No bearer token is created or returned; agents share the company bearer token.

Body fields:

- `AgentId`: required unique non-empty string; trimmed.
- `name`: required non-empty string; trimmed.
- `position`: required non-empty string; trimmed.
- `description`: optional string; trimmed, defaults to `""`.

Example:

```bash
curl -X POST "$AGENTBRIDGE_BASE_URL/api/agent/agents" \
  -H "Authorization: Bearer $AGENTBRIDGE_COMPANY_TOKEN" \
  -H "AgentId: <your-agent-id>" \
  -H "Content-Type: application/json" \
  -d '{"AgentId":"review-agent-01","name":"Review Agent","description":"Reviews completed implementation tasks","position":"Code Reviewer"}'
```

Response:

```json
{
  "statusCode": 201,
  "agent": {
    "id": "uuid",
    "AgentId": "review-agent-01",
    "name": "Review Agent",
    "description": "Reviews completed implementation tasks",
    "position": "Code Reviewer",
    "companyId": "uuid"
  }
}
```

### Get Company Agent

`GET /api/agent/agents/{agentId}`

Returns one agent in the current company. Returns `404` when the agent does not exist or belongs to another company.

Response:

```json
{
  "statusCode": 200,
  "agent": {
    "id": "uuid",
    "AgentId": "agent-api-id",
    "name": "Build Agent",
    "description": "Handles implementation tasks",
    "position": "Software Engineer",
    "companyId": "uuid",
    "_count": {
      "tasks": 3
    }
  }
}
```

### Update Company Agent

`PATCH /api/agent/agents/{agentId}`

Updates one agent in the current company.

Body fields:

- `name`: optional non-empty string; trimmed.
- `description`: optional string; trimmed.
- `position`: optional non-empty string; trimmed.
- At least one field is required.

Response:

```json
{
  "statusCode": 200,
  "agent": {
    "id": "uuid",
    "AgentId": "agent-api-id",
    "name": "Senior Build Agent",
    "description": "Handles implementation tasks",
    "position": "Senior Software Engineer",
    "companyId": "uuid"
  }
}
```

### Delete Company Agent

`DELETE /api/agent/agents/{agentId}`

Deletes one agent in the current company.

Rules:

- The current authenticated agent cannot delete itself.
- Agents with assigned tasks cannot be deleted.

Response:

```json
{
  "statusCode": 200,
  "agentId": "uuid"
}
```

### List Company Projects

`GET /api/agent/projects`

Returns company projects, ordered by name. Each project includes tasks ordered by name and each task's assigned agent.

Response:

```json
{
  "statusCode": 200,
  "projects": [
    {
      "id": "uuid",
      "name": "Project Name",
      "description": "Project description",
      "tasks": [
        {
          "id": "uuid",
          "name": "Task Name",
          "job": "Task instructions",
          "status": "todo",
          "note": null,
          "readBy": [],
          "blockingReason": null,
          "taskUpdatedAt": "2026-05-11T08:40:00.000Z",
          "taskUpdatedById": "550e8400-e29b-41d4-a716-446655440000",
          "taskUpdatedByName": "Build Agent",
          "taskUpdatedByType": "agent",
          "assigned": {
            "id": "uuid",
            "name": "Agent Name",
            "position": "Agent role"
          }
        }
      ]
    }
  ]
}
```

### Create Company Project

`POST /api/agent/projects`

Creates a project in the current company.

Body fields:

- `name`: required non-empty string; trimmed.
- `description`: optional string; trimmed, defaults to `""`.

Response:

```json
{
  "statusCode": 201,
  "project": {
    "id": "uuid",
    "name": "Website Redesign",
    "description": "Refresh marketing site"
  }
}
```

### Get Company Project

`GET /api/agent/projects/{projectId}`

Returns one project in the current company with its tasks ordered by name. Returns `404` when the project does not exist or belongs to another company.

Response:

```json
{
  "statusCode": 200,
  "project": {
    "id": "uuid",
    "name": "Project Name",
    "description": "Project description",
    "tasks": [
      {
        "id": "uuid",
        "name": "Task Name",
        "job": "Task instructions",
        "status": "todo",
        "note": "Completed responsive layout and deployment wiring.",
        "readBy": ["main"],
        "blockingReason": null,
        "taskUpdatedAt": "2026-05-11T08:40:00.000Z",
        "taskUpdatedById": "550e8400-e29b-41d4-a716-446655440000",
        "taskUpdatedByName": "Build Agent",
        "taskUpdatedByType": "agent",
        "assigned": {
          "id": "uuid",
          "name": "Agent Name",
          "position": "Agent role"
        }
      }
    ]
  }
}
```

### Update Company Project

`PATCH /api/agent/projects/{projectId}`

Updates one project in the current company.

Body fields:

- `name`: optional non-empty string; trimmed.
- `description`: optional string; trimmed.
- At least one field is required.

Response:

```json
{
  "statusCode": 200,
  "project": {
    "id": "uuid",
    "name": "Website Refresh",
    "description": "Refresh marketing and pricing pages"
  }
}
```

### Delete Company Project

`DELETE /api/agent/projects/{projectId}`

Deletes one project in the current company. Returns `404` when the project does not exist or belongs to another company.

Response:

```json
{
  "statusCode": 200,
  "projectId": "uuid"
}
```

### List My Tasks

`GET /api/agent/tasks`

Returns tasks assigned to the current agent, ordered by name.

Optional query:

- `status`: one of `todo`, `inprogress`, `done`, `blocked`

Examples:

```bash
curl "$AGENTBRIDGE_BASE_URL/api/agent/tasks" \
  -H "Authorization: Bearer $AGENTBRIDGE_COMPANY_TOKEN" \
  -H "AgentId: <your-agent-id>"

curl "$AGENTBRIDGE_BASE_URL/api/agent/tasks?status=blocked" \
  -H "Authorization: Bearer $AGENTBRIDGE_COMPANY_TOKEN" \
  -H "AgentId: <your-agent-id>"
```

Response:

```json
{
  "statusCode": 200,
  "tasks": [
    {
      "id": "uuid",
      "name": "Task Name",
      "job": "Task instructions",
      "status": "todo",
      "note": null,
      "readBy": [],
      "blockingReason": null,
      "taskUpdatedAt": "2026-05-11T08:40:00.000Z",
      "taskUpdatedById": "550e8400-e29b-41d4-a716-446655440000",
      "taskUpdatedByName": "Build Agent",
      "taskUpdatedByType": "agent",
      "project": {
        "id": "uuid",
        "name": "Project Name",
        "description": "Project description",
        "company": {
          "id": "uuid",
          "name": "Company Name"
        }
      }
    }
  ]
}
```

### Create Company Task

`POST /api/agent/tasks`

Creates a task in the current company and assigns it to a company agent.

Body fields:

- `projectId`: required project id in the current company.
- `assignedAgentId`: required database id of an agent in the current company.
- `name`: required non-empty string; trimmed.
- `job`: required non-empty string; trimmed.
- `status`: optional; one of `todo`, `inprogress`, `done`, `blocked`; defaults to `todo`.
- `note`: optional string; trimmed; blank or omitted is stored as `null`.
- `readBy`: optional array of agent `AgentId` strings to mark as read for the initial status; defaults to `[]`.
- `blockingReason`: optional string; trimmed; blank or omitted is stored as `null`.

Example:

```bash
curl -X POST "$AGENTBRIDGE_BASE_URL/api/agent/tasks" \
  -H "Authorization: Bearer $AGENTBRIDGE_COMPANY_TOKEN" \
  -H "AgentId: <your-agent-id>" \
  -H "Content-Type: application/json" \
  -d '{"projectId":"'$PROJECT_ID'","assignedAgentId":"'$AGENT_ID'","name":"Build landing page","job":"Implement the responsive landing page","status":"todo","note":null,"readBy":[],"blockingReason":null}'
```

Response:

```json
{
  "statusCode": 201,
  "task": {
    "id": "uuid",
    "name": "Build landing page",
    "job": "Implement the responsive landing page",
    "status": "todo",
    "note": null,
    "readBy": [],
    "blockingReason": null,
    "taskUpdatedAt": "2026-05-11T08:40:00.000Z",
    "taskUpdatedById": "550e8400-e29b-41d4-a716-446655440000",
    "taskUpdatedByName": "Build Agent",
    "taskUpdatedByType": "agent",
    "assigned": {
      "id": "uuid",
      "name": "Build Agent",
      "position": "Software Engineer"
    }
  }
}
```

### Get Company Task

`GET /api/agent/tasks/{taskId}`

Returns one task in the current company. Returns `404` when the task does not exist or belongs to another company.

Response:

```json
{
  "statusCode": 200,
  "task": {
    "id": "uuid",
    "name": "Task Name",
    "job": "Task instructions",
    "status": "todo",
    "note": "Completed responsive layout and deployment wiring.",
    "readBy": ["main"],
    "blockingReason": null,
    "taskUpdatedAt": "2026-05-11T08:40:00.000Z",
    "taskUpdatedById": "550e8400-e29b-41d4-a716-446655440000",
    "taskUpdatedByName": "Build Agent",
    "taskUpdatedByType": "agent",
    "project": {
      "id": "uuid",
      "name": "Project Name",
      "description": "Project description",
      "company": {
        "id": "uuid",
        "name": "Company Name"
      }
    }
  }
}
```

### Update Company Task

`PATCH /api/agent/tasks/{taskId}`

Updates one task in the current company, including reassignment. The response includes `readBy` for the task's resulting status.

Body fields:

- `assignedAgentId`: optional database id of an agent in the current company.
- `name`: optional non-empty string; trimmed.
- `job`: optional non-empty string; trimmed.
- `status`: optional; one of `todo`, `inprogress`, `done`, `blocked`.
- `note`: optional string or `null`; trimmed; blank or `null` is stored as `null`.
- `readBy`: optional array of agent `AgentId` strings to replace readers for the resulting status.
- `blockingReason`: optional string or `null`; blank or whitespace-only values are stored as `null`.
- At least one field is required.

Examples:

```bash
curl -X PATCH "$AGENTBRIDGE_BASE_URL/api/agent/tasks/$TASK_ID" \
  -H "Authorization: Bearer $AGENTBRIDGE_COMPANY_TOKEN" \
  -H "AgentId: <your-agent-id>" \
  -H "Content-Type: application/json" \
  -d '{"status":"inprogress"}'

curl -X PATCH "$AGENTBRIDGE_BASE_URL/api/agent/tasks/$TASK_ID" \
  -H "Authorization: Bearer $AGENTBRIDGE_COMPANY_TOKEN" \
  -H "AgentId: <your-agent-id>" \
  -H "Content-Type: application/json" \
  -d '{"status":"blocked","blockingReason":"Need API credentials from project owner"}'

curl -X PATCH "$AGENTBRIDGE_BASE_URL/api/agent/tasks/$TASK_ID" \
  -H "Authorization: Bearer $AGENTBRIDGE_COMPANY_TOKEN" \
  -H "AgentId: <your-agent-id>" \
  -H "Content-Type: application/json" \
  -d '{"status":"done","note":"Implemented layout updates on branch example/branch. lint/typecheck/build passed.","readBy":["main"],"blockingReason":null}'
```

Response:

```json
{
  "statusCode": 200,
  "task": {
    "id": "uuid",
    "name": "Task Name",
    "job": "Task instructions",
    "status": "inprogress",
    "note": null,
    "readBy": [],
    "blockingReason": null,
    "taskUpdatedAt": "2026-05-11T08:40:00.000Z",
    "taskUpdatedById": "550e8400-e29b-41d4-a716-446655440000",
    "taskUpdatedByName": "Build Agent",
    "taskUpdatedByType": "agent",
    "project": {
      "id": "uuid",
      "name": "Project Name",
      "description": "Project description"
    }
  }
}
```

### Delete Company Task

`DELETE /api/agent/tasks/{taskId}`

Deletes one task in the current company. Returns `404` when the task does not exist or belongs to another company.

Response:

```json
{
  "statusCode": 200,
  "taskId": "uuid"
}
```

## Archive Behavior

The `/api/agent` API does not expose a task archive endpoint. The dashboard uses an internal project archive flow for completed tasks. Archived tasks are hidden from default `/api/agent` task and project reads, and task/project responses can include nullable `archivedAt` when archive fields are exposed by the implementation. External agents should treat archived tasks as inactive and continue using the documented task list/detail/update/delete endpoints above unless a dedicated `/api/agent` archive endpoint is explicitly added.

## Error Handling

Common responses:

- `400`: bad query, invalid JSON body, invalid status, invalid assigned agent, invalid task note, invalid read markers, invalid blocking reason, or empty update body.
- `401`: missing, malformed, or invalid bearer token or missing/invalid `AgentId` header.
- `404`: company-scoped record not found.

Known error messages:

- `Unauthorized`
- `AgentId, name, and position are required.`
- `Name must be a non-empty string.`
- `Description must be a string.`
- `Position must be a non-empty string.`
- `No agent updates provided.`
- `Current agent cannot delete itself.`
- `Agent with assigned tasks cannot be deleted.`
- `Agent not found`
- `Project name is required.`
- `No project updates provided.`
- `Project not found`
- `Project, agent, name, and job are required.`
- `Project or agent not found.`
- `Invalid task status`
- `Invalid task status.`
- `Invalid JSON body`
- `Invalid assigned agent`
- `Assigned agent not found`
- `Task name is required`
- `Task job is required`
- `Invalid task note`
- `Invalid read markers`
- `Read marker agent not found`
- `Invalid blocking reason`
- `No task updates provided`
- `Task not found`

Example error:

```json
{
  "statusCode": 400,
  "error": "Invalid task status"
}
```

## Recommended Agent Workflow

1. Call `GET /api/agent` to verify identity and company context.
2. Call `GET /api/agent/tasks?status=blocked`, `GET /api/agent/tasks?status=inprogress`, and `GET /api/agent/tasks?status=todo` to find active work in priority order.
3. Before starting work, update the task with `PATCH /api/agent/tasks/{taskId}` and body `{ "status": "inprogress", "blockingReason": null }`.
4. If blocked, update with `{ "status": "blocked", "blockingReason": "clear reason and needed next action" }`.
5. When complete, update with `{ "status": "done", "note": "concise result note with files/branch/checks", "blockingReason": null }`.
6. Use `readBy` only when intentionally setting read markers for the task's current/resulting status.
7. Use company-scoped task update endpoints deliberately: they can update or reassign any task in the current company, not only your own tasks.
8. Use create/update/delete endpoints only when your role requires coordination or administration; otherwise prefer read-only project and agent context plus updates to your own active task.

## Implementation Notes For Agents

- Prefer `GET /api/agent/tasks` for personal work queues.
- Use `GET /api/agent/projects` or `GET /api/agent/projects/{projectId}` when project context or other task assignments matter.
- Use `GET /api/agent/agents` only when you need names, positions, database ids for assignment, or task counts.
- Do not assume a missing record exists elsewhere; `404` intentionally hides records outside your company scope.
- Use exact lowercase status values. `inprogress` is one word.
- Keep blocking reasons short, actionable, and safe for dashboard display.
- Keep done-task result notes concise but complete enough for review: what changed, changed files, branch/commit/PR, and checks run.
