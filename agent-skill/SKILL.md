# AgentBridge Agent API Skill

Use this skill when acting as an external agent that needs to read or update work through the AgentBridge `/api/agent` HTTP API.

## Core Rules

- All agent API paths are under `/api/agent`.
- Authenticate every request with `Authorization: Bearer <agent-token>`.
- Never log, print, store, or expose the bearer token.
- Treat `bearerTokenHash` as private; the API must never return it and agents must not ask for it.
- Read the `statusCode` field in every JSON response. It should match the HTTP status.
- Error shape is `{ "statusCode": number, "error": string }`.
- Valid task statuses are `todo`, `inprogress`, `done`, and `blocked`.
- A task can only be read or updated by the assigned agent.
- Company-scoped lists only show records from the current agent's company.

## Base Request Shape

```bash
curl "$AGENTBRIDGE_BASE_URL/api/agent" \
  -H "Authorization: Bearer $AGENTBRIDGE_AGENT_TOKEN" \
  -H "Accept: application/json"
```

Use `Content-Type: application/json` on requests with JSON bodies.

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
          "blockingReason": null,
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

### List My Tasks

`GET /api/agent/tasks`

Returns tasks assigned to the current agent, ordered by name.

Optional query:

- `status`: one of `todo`, `inprogress`, `done`, `blocked`

Examples:

```bash
curl "$AGENTBRIDGE_BASE_URL/api/agent/tasks" \
  -H "Authorization: Bearer $AGENTBRIDGE_AGENT_TOKEN"

curl "$AGENTBRIDGE_BASE_URL/api/agent/tasks?status=blocked" \
  -H "Authorization: Bearer $AGENTBRIDGE_AGENT_TOKEN"
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
      "blockingReason": null,
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

### Get My Task

`GET /api/agent/tasks/{taskId}`

Returns one task assigned to the current agent. Returns `404` when the task does not exist or is assigned to another agent.

Response:

```json
{
  "statusCode": 200,
  "task": {
    "id": "uuid",
    "name": "Task Name",
    "job": "Task instructions",
    "status": "todo",
    "blockingReason": null,
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

### Update My Task

`PATCH /api/agent/tasks/{taskId}`

Updates status and/or blocking reason on one task assigned to the current agent.

Body fields:

- `status`: optional; one of `todo`, `inprogress`, `done`, `blocked`
- `blockingReason`: optional; string or `null`
- At least one field is required.
- Blank or whitespace-only `blockingReason` is stored as `null`.

Examples:

```bash
curl -X PATCH "$AGENTBRIDGE_BASE_URL/api/agent/tasks/$TASK_ID" \
  -H "Authorization: Bearer $AGENTBRIDGE_AGENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"inprogress"}'

curl -X PATCH "$AGENTBRIDGE_BASE_URL/api/agent/tasks/$TASK_ID" \
  -H "Authorization: Bearer $AGENTBRIDGE_AGENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"blocked","blockingReason":"Need API credentials from project owner"}'

curl -X PATCH "$AGENTBRIDGE_BASE_URL/api/agent/tasks/$TASK_ID" \
  -H "Authorization: Bearer $AGENTBRIDGE_AGENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"done","blockingReason":null}'
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
    "blockingReason": null,
    "project": {
      "id": "uuid",
      "name": "Project Name",
      "description": "Project description"
    }
  }
}
```

## Error Handling

Common responses:

- `400`: bad query, invalid JSON body, invalid status, invalid blocking reason, or empty update body.
- `401`: missing, malformed, or invalid bearer token.
- `404`: task not found or not assigned to current agent.

Known error messages:

- `Unauthorized`
- `Invalid task status`
- `Invalid JSON body`
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
2. Call `GET /api/agent/tasks?status=todo` and `GET /api/agent/tasks?status=inprogress` to find active work.
3. Before starting work, update the task with `PATCH /api/agent/tasks/{taskId}` and body `{ "status": "inprogress", "blockingReason": null }`.
4. If blocked, update with `{ "status": "blocked", "blockingReason": "clear reason and needed next action" }`.
5. When complete, update with `{ "status": "done", "blockingReason": null }`.
6. Do not update tasks assigned to other agents; the API will reject them with `404`.

## Implementation Notes For Agents

- Prefer `GET /api/agent/tasks` for personal work queues.
- Use `GET /api/agent/projects` when project context or other task assignments matter.
- Use `GET /api/agent/agents` only when you need names, positions, or task counts for company agents.
- Do not assume a missing task exists elsewhere; `404` intentionally hides tasks outside your assignment.
- Use exact lowercase status values. `inprogress` is one word.
- Keep blocking reasons short, actionable, and safe for dashboard display.
