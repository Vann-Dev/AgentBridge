import path from "node:path"
import swaggerJsdoc from "swagger-jsdoc"

const fallbackAgentApiPaths = {
  "/api/agent": {
    get: { tags: ["Profile"], summary: "Get current agent" },
  },
  "/api/agent/agents": {
    get: { tags: ["Agents"], summary: "List company agents" },
    post: { tags: ["Agents"], summary: "Create company agent" },
  },
  "/api/agent/agents/{agentId}": {
    get: {
      tags: ["Agents"],
      summary: "Get company agent",
      parameters: [{ $ref: "#/components/parameters/PathAgentId" }],
    },
    patch: {
      tags: ["Agents"],
      summary: "Update company agent",
      parameters: [{ $ref: "#/components/parameters/PathAgentId" }],
    },
    delete: {
      tags: ["Agents"],
      summary: "Delete company agent",
      parameters: [{ $ref: "#/components/parameters/PathAgentId" }],
    },
  },
  "/api/agent/projects": {
    get: { tags: ["Projects"], summary: "List company projects" },
    post: { tags: ["Projects"], summary: "Create project" },
  },
  "/api/agent/projects/{projectId}": {
    get: {
      tags: ["Projects"],
      summary: "Get project",
      parameters: [{ $ref: "#/components/parameters/ProjectId" }],
    },
    patch: {
      tags: ["Projects"],
      summary: "Update project",
      parameters: [{ $ref: "#/components/parameters/ProjectId" }],
    },
    delete: {
      tags: ["Projects"],
      summary: "Delete project",
      parameters: [{ $ref: "#/components/parameters/ProjectId" }],
    },
  },
  "/api/agent/tasks": {
    get: { tags: ["Tasks"], summary: "List current agent tasks" },
    post: { tags: ["Tasks"], summary: "Create task" },
  },
  "/api/agent/tasks/{taskId}": {
    get: {
      tags: ["Tasks"],
      summary: "Get task",
      parameters: [{ $ref: "#/components/parameters/TaskId" }],
    },
    patch: {
      tags: ["Tasks"],
      summary: "Update task",
      parameters: [{ $ref: "#/components/parameters/TaskId" }],
    },
    delete: {
      tags: ["Tasks"],
      summary: "Delete task",
      parameters: [{ $ref: "#/components/parameters/TaskId" }],
    },
  },
}

type OpenApiDocument = ReturnType<typeof swaggerJsdoc> & {
  paths?: Record<string, unknown>
}

export function getFallbackAgentApiPaths() {
  return fallbackAgentApiPaths
}

function withFallbackAgentApiPaths(document: OpenApiDocument) {
  if (Object.keys(document.paths ?? {}).length > 0) {
    return document
  }

  return { ...document, paths: fallbackAgentApiPaths }
}

export function getAgentApiGlobs() {
  return [
    path.join(process.cwd(), "app/api/agent/**/*.ts"),
    path.join(process.cwd(), "app/api/agent/route.ts"),
  ]
}

export function createOpenApiDocument() {
  return withFallbackAgentApiPaths(
    swaggerJsdoc({
      definition: {
        openapi: "3.1.0",
      info: {
        title: "AgentBridge Agent API",
        description:
          "Coordinate AI agents, projects, and tasks through AgentBridge company-scoped API endpoints.",
        version: "0.1.0",
      },
      servers: [{ url: "/" }],
      tags: [
        {
          name: "Profile",
          description: "Current authenticated agent profile.",
        },
        {
          name: "Agents",
          description: "Manage agents in the authenticated agent's company.",
        },
        {
          name: "Projects",
          description: "Manage projects in the authenticated agent's company.",
        },
        {
          name: "Tasks",
          description: "Manage tasks in the authenticated agent's company.",
        },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: "http",
            scheme: "bearer",
            description: "Company-level bearer token.",
          },
        },
        schemas: {
          Status: {
            type: "string",
            enum: ["todo", "inprogress", "done", "blocked"],
          },
          Error: {
            type: "object",
            properties: {
              statusCode: { type: "integer" },
              error: { type: "string" },
            },
            required: ["statusCode", "error"],
          },
          Project: {
            type: "object",
            properties: {
              id: { type: "string", format: "uuid" },
              name: { type: "string" },
              description: { type: "string" },
            },
            required: ["id", "name", "description"],
          },
          ProjectAgent: {
            type: "object",
            properties: {
              id: { type: "string", format: "uuid" },
              AgentId: {
                type: "string",
                description: "Stable API identifier used in the AgentId header.",
              },
              name: { type: "string" },
              description: { type: "string" },
              position: { type: "string" },
            },
            required: ["id", "AgentId", "name", "description", "position"],
          },
          Agent: {
            type: "object",
            properties: {
              id: { type: "string", format: "uuid" },
              AgentId: {
                type: "string",
                description: "Stable API identifier used in the AgentId header.",
              },
              name: { type: "string" },
              description: { type: "string" },
              position: { type: "string" },
              projectIds: {
                type: "array",
                items: { type: "string", format: "uuid" },
              },
              projects: {
                type: "array",
                items: { $ref: "#/components/schemas/Project" },
              },
            },
            required: [
              "id",
              "AgentId",
              "name",
              "description",
              "position",
              "projectIds",
              "projects",
            ],
          },
          CurrentAgent: {
            allOf: [
              { $ref: "#/components/schemas/ProjectAgent" },
              {
                type: "object",
                properties: {
                  company: {
                    type: "object",
                    properties: {
                      id: { type: "string", format: "uuid" },
                      name: { type: "string" },
                      description: { type: "string" },
                    },
                    required: ["id", "name", "description"],
                  },
                },
                required: ["company"],
              },
            ],
          },
          TaskSummary: {
            type: "object",
            properties: {
              id: { type: "string", format: "uuid" },
              name: { type: "string" },
              status: { $ref: "#/components/schemas/Status" },
            },
            required: ["id", "name", "status"],
          },
          Task: {
            type: "object",
            properties: {
              id: { type: "string", format: "uuid" },
              name: { type: "string" },
              job: { type: "string" },
              status: { $ref: "#/components/schemas/Status" },
              note: {
                type: ["string", "null"],
                description: "Completion note or summary describing what changed.",
              },
              summaryUpdatedAt: {
                type: ["string", "null"],
                format: "date-time",
                description: "When note/summary was last explicitly changed.",
              },
              taskUpdatedAt: { type: "string", format: "date-time" },
              taskUpdatedById: { type: ["string", "null"], format: "uuid" },
              taskUpdatedByName: { type: ["string", "null"] },
              taskUpdatedByType: { type: "string" },
              blockingReason: { type: ["string", "null"] },
              archivedAt: { type: ["string", "null"], format: "date-time" },
              project: { $ref: "#/components/schemas/Project" },
              assigned: { $ref: "#/components/schemas/ProjectAgent" },
              dependencies: {
                type: "array",
                items: { $ref: "#/components/schemas/TaskSummary" },
              },
              dependencyIds: {
                type: "array",
                items: { type: "string", format: "uuid" },
              },
              unblocks: {
                type: "array",
                items: { $ref: "#/components/schemas/TaskSummary" },
              },
              isDependencyReady: { type: "boolean" },
              readBy: {
                type: "array",
                description: "AgentId values that have read this task in its current status.",
                items: { type: "string" },
              },
            },
            required: [
              "id",
              "name",
              "job",
              "status",
              "note",
              "summaryUpdatedAt",
              "taskUpdatedAt",
              "taskUpdatedById",
              "taskUpdatedByName",
              "taskUpdatedByType",
              "blockingReason",
              "archivedAt",
              "project",
              "assigned",
              "dependencies",
              "dependencyIds",
              "unblocks",
              "isDependencyReady",
              "readBy",
            ],
          },
          TaskWithProject: {
            allOf: [
              { $ref: "#/components/schemas/Task" },
              {
                type: "object",
                properties: {
                  project: { $ref: "#/components/schemas/Project" },
                },
                required: ["project"],
              },
            ],
          },
          ProjectWithAgents: {
            allOf: [
              { $ref: "#/components/schemas/Project" },
              {
                type: "object",
                properties: {
                  agents: {
                    type: "array",
                    items: { $ref: "#/components/schemas/ProjectAgent" },
                  },
                  agentIds: {
                    type: "array",
                    items: { type: "string", format: "uuid" },
                  },
                },
                required: ["agents", "agentIds"],
              },
            ],
          },
          ProjectWithTasks: {
            allOf: [
              { $ref: "#/components/schemas/Project" },
              {
                type: "object",
                properties: {
                  agents: {
                    type: "array",
                    items: { $ref: "#/components/schemas/ProjectAgent" },
                  },
                  agentIds: {
                    type: "array",
                    items: { type: "string", format: "uuid" },
                  },
                  tasks: {
                    type: "array",
                    items: { $ref: "#/components/schemas/TaskWithProject" },
                  },
                },
                required: ["agents", "agentIds", "tasks"],
              },
            ],
          },
          AgentsResponse: {
            type: "object",
            properties: {
              statusCode: { type: "integer", example: 200 },
              agents: { type: "array", items: { $ref: "#/components/schemas/Agent" } },
            },
            required: ["statusCode", "agents"],
          },
          AgentResponse: {
            type: "object",
            properties: {
              statusCode: { type: "integer", example: 200 },
              agent: { $ref: "#/components/schemas/Agent" },
            },
            required: ["statusCode", "agent"],
          },
          AgentDeleteResponse: {
            type: "object",
            properties: {
              statusCode: { type: "integer", example: 200 },
              agentId: { type: "string", format: "uuid" },
            },
            required: ["statusCode", "agentId"],
          },
          ProjectsResponse: {
            type: "object",
            properties: {
              statusCode: { type: "integer", example: 200 },
              projects: {
                type: "array",
                items: { $ref: "#/components/schemas/ProjectWithAgents" },
              },
            },
            required: ["statusCode", "projects"],
          },
          ProjectResponse: {
            type: "object",
            properties: {
              statusCode: { type: "integer", example: 200 },
              project: { $ref: "#/components/schemas/ProjectWithTasks" },
            },
            required: ["statusCode", "project"],
          },
          ProfileResponse: {
            type: "object",
            properties: {
              statusCode: { type: "integer", example: 200 },
              agent: { $ref: "#/components/schemas/CurrentAgent" },
            },
            required: ["statusCode", "agent"],
          },
          TasksResponse: {
            type: "object",
            properties: {
              statusCode: { type: "integer", example: 200 },
              tasks: { type: "array", items: { $ref: "#/components/schemas/TaskWithProject" } },
            },
            required: ["statusCode", "tasks"],
          },
          TaskResponse: {
            type: "object",
            properties: {
              statusCode: { type: "integer", example: 200 },
              task: { $ref: "#/components/schemas/TaskWithProject" },
            },
            required: ["statusCode", "task"],
          },
          TaskDeleteResponse: {
            type: "object",
            properties: {
              statusCode: { type: "integer", example: 200 },
              taskId: { type: "string", format: "uuid" },
            },
            required: ["statusCode", "taskId"],
          },
        },
        responses: {
          BadRequest: {
            description: "Invalid request",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
          },
          Unauthorized: {
            description: "Missing or invalid bearer token",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
          },
          NotFound: {
            description: "Resource not found",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
          },
        },
        parameters: {
          TaskId: {
            name: "taskId",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
          AgentId: {
            name: "AgentId",
            in: "header",
            required: true,
            description:
              "Stable API identifier for the acting agent, such as main, ume, or review-agent-01. This is not the agent database UUID.",
            schema: { type: "string", example: "main" },
          },
          PathAgentId: {
            name: "agentId",
            in: "path",
            required: true,
            description:
              "Agent database UUID. This path value is distinct from the API-facing AgentId string used in the header and agent payloads.",
            schema: { type: "string", format: "uuid" },
          },
          ProjectId: {
            name: "projectId",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
        },
      },
      security: [{ bearerAuth: [] }],
    },
    apis: getAgentApiGlobs(),
    }) as OpenApiDocument
  )
}
