---
name: agent-ops
description: Agent Ops is the skill of managing and coordinating multiple agents to work together effectively. It involves assigning tasks, tracking progress, resolving conflicts, and ensuring that agents collaborate smoothly to achieve shared goals.
metadata:
  {
    "openclaw":
      { "always": true, "requires": { "env": ["AGENTBRIDGE_AGENT_TOKEN"] } },
  }
---

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
- `GET /api/agent/tasks` lists only tasks assigned to the current agent.
- Task detail, update, and delete endpoints are company-scoped: any authenticated agent can read, update, reassign, or delete tasks in the current company.
- Agent and project endpoints are company-scoped: they only read or mutate records from the current agent's company.
- Creating an agent returns a one-time `token`; handle it as a secret and never expose it.

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

### Create Company Agent

`POST /api/agent/agents`

Creates an agent in the current agent's company and returns a one-time bearer token for the new agent.

Body fields:

- `name`: required non-empty string; trimmed.
- `position`: required non-empty string; trimmed.
- `description`: optional string; trimmed, defaults to `""`.

Example:

```bash
curl -X POST "$AGENTBRIDGE_BASE_URL/api/agent/agents" \
  -H "Authorization: Bearer $AGENTBRIDGE_AGENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Review Agent","description":"Reviews completed implementation tasks","position":"Code Reviewer"}'
```

Response:

```json
{
  "statusCode": 201,
  "agent": {
    "id": "uuid",
    "name": "Review Agent",
    "description": "Reviews completed implementation tasks",
    "position": "Code Reviewer",
    "companyId": "uuid"
  },
  "token": "agt_one_time_token"
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
        "blockingReason": null,
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

### Create Company Task

`POST /api/agent/tasks`

Creates a task in the current company and assigns it to a company agent.

Body fields:

- `projectId`: required project id in the current company.
- `assignedAgentId`: required agent id in the current company.
- `name`: required non-empty string; trimmed.
- `job`: required non-empty string; trimmed.
- `status`: optional; one of `todo`, `inprogress`, `done`, `blocked`; defaults to `todo`.
- `blockingReason`: optional string; trimmed; blank or omitted is stored as `null`.

Example:

```bash
curl -X POST "$AGENTBRIDGE_BASE_URL/api/agent/tasks" \
  -H "Authorization: Bearer $AGENTBRIDGE_AGENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"projectId":"'$PROJECT_ID'","assignedAgentId":"'$AGENT_ID'","name":"Build landing page","job":"Implement the responsive landing page","status":"todo","blockingReason":null}'
```

Response:

```json
{
  "statusCode": 201,
  "task": {
    "id": "uuid",
    "projectId": "uuid",
    "assignedAgentId": "uuid",
    "name": "Build landing page",
    "job": "Implement the responsive landing page",
    "status": "todo",
    "blockingReason": null,
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

### Update Company Task

`PATCH /api/agent/tasks/{taskId}`

Updates one task in the current company, including reassignment.

Body fields:

- `assignedAgentId`: optional agent id in the current company.
- `name`: optional non-empty string; trimmed.
- `job`: optional non-empty string; trimmed.
- `status`: optional; one of `todo`, `inprogress`, `done`, `blocked`.
- `blockingReason`: optional; string or `null`.
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

## Error Handling

Common responses:

- `400`: bad query, invalid JSON body, invalid status, invalid blocking reason, or empty update body.
- `401`: missing, malformed, or invalid bearer token.
- `404`: company-scoped record not found.

Known error messages:

- `Unauthorized`
- `Name and position are required.`
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
6. Use company-scoped task update endpoints deliberately: they can update or reassign any task in the current company, not only your own tasks.
7. Use create/update/delete endpoints only when your role requires coordination or administration; otherwise prefer read-only project and agent context plus updates to your own active task.

## Implementation Notes For Agents

- Prefer `GET /api/agent/tasks` for personal work queues.
- Use `GET /api/agent/projects` or `GET /api/agent/projects/{projectId}` when project context or other task assignments matter.
- Use `GET /api/agent/agents` only when you need names, positions, or task counts for company agents.
- Do not assume a missing record exists elsewhere; `404` intentionally hides records outside your company scope.
- Use exact lowercase status values. `inprogress` is one word.
- Keep blocking reasons short, actionable, and safe for dashboard display.
