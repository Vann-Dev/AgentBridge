import { NextResponse } from "next/server"
import swaggerJsdoc from "swagger-jsdoc"

const openApiDocument = swaggerJsdoc({
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
        Company: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            name: { type: "string" },
            description: { type: "string" },
          },
          required: ["id", "name", "description"],
        },
        Agent: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            AgentId: {
              type: "string",
              description: "Stable API identifier used in the AgentId header, for example main or review-agent-01.",
              examples: ["main", "review-agent-01"],
            },
            name: { type: "string" },
            description: { type: "string" },
            position: { type: "string" },
            companyId: { type: "string", format: "uuid" },
          },
          required: ["id", "AgentId", "name", "description", "position", "companyId"],
        },
        CompanyAgent: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            AgentId: {
              type: "string",
              description: "Stable API identifier used in the AgentId header, for example main or review-agent-01.",
              examples: ["main", "review-agent-01"],
            },
            name: { type: "string" },
            description: { type: "string" },
            position: { type: "string" },
            companyId: { type: "string", format: "uuid" },
            _count: {
              type: "object",
              properties: { tasks: { type: "integer" } },
              required: ["tasks"],
            },
          },
          required: ["id", "AgentId", "name", "description", "position", "_count"],
        },
        Task: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            name: { type: "string" },
            job: { type: "string" },
            status: { $ref: "#/components/schemas/Status" },
            note: { type: "string", nullable: true },
            readBy: {
              type: "array",
              items: { type: "string" },
              description: "AgentId values that have read this task in its current status.",
            },
            blockingReason: { type: "string", nullable: true },
            archivedAt: { type: "string", format: "date-time", nullable: true },
          },
          required: ["id", "name", "job", "status", "note", "readBy", "blockingReason", "archivedAt"],
        },
        TaskWithProject: {
          allOf: [
            { $ref: "#/components/schemas/Task" },
            {
              type: "object",
              properties: {
                project: {
                  allOf: [
                    { $ref: "#/components/schemas/Project" },
                    {
                      type: "object",
                      properties: {
                        company: {
                          type: "object",
                          properties: {
                            id: { type: "string", format: "uuid" },
                            name: { type: "string" },
                          },
                          required: ["id", "name"],
                        },
                      },
                    },
                  ],
                },
              },
              required: ["project"],
            },
          ],
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
        ProjectWithTasks: {
          allOf: [
            { $ref: "#/components/schemas/Project" },
            {
              type: "object",
              properties: {
                tasks: {
                  type: "array",
                  items: {
                    allOf: [
                      { $ref: "#/components/schemas/Task" },
                      {
                        type: "object",
                        properties: {
                          assigned: {
                            type: "object",
                            properties: {
                              id: { type: "string", format: "uuid" },
                              name: { type: "string" },
                              position: { type: "string" },
                            },
                            required: ["id", "name", "position"],
                          },
                        },
                        required: ["assigned"],
                      },
                    ],
                  },
                },
              },
              required: ["tasks"],
            },
          ],
        },
        AgentResponse: {
          type: "object",
          properties: {
            statusCode: { type: "integer", enum: [200] },
            agent: {
              allOf: [
                { $ref: "#/components/schemas/Agent" },
                {
                  type: "object",
                  properties: { company: { $ref: "#/components/schemas/Company" } },
                  required: ["company"],
                },
              ],
            },
          },
          required: ["statusCode", "agent"],
        },
        AgentCreatedResponse: {
          type: "object",
          properties: {
            statusCode: { type: "integer", enum: [201] },
            agent: { $ref: "#/components/schemas/Agent" },
          },
          required: ["statusCode", "agent"],
        },
        CompanyAgentResponse: {
          type: "object",
          properties: {
            statusCode: { type: "integer", enum: [200] },
            agent: { $ref: "#/components/schemas/CompanyAgent" },
          },
          required: ["statusCode", "agent"],
        },
        TaskResponse: {
          type: "object",
          properties: {
            statusCode: { type: "integer", enum: [200] },
            task: { $ref: "#/components/schemas/TaskWithProject" },
          },
          required: ["statusCode", "task"],
        },
        TaskCreatedResponse: {
          type: "object",
          properties: {
            statusCode: { type: "integer", enum: [201] },
            task: {
              allOf: [
                { $ref: "#/components/schemas/Task" },
                {
                  type: "object",
                  properties: {
                    assigned: {
                      type: "object",
                      properties: {
                        id: { type: "string", format: "uuid" },
                        name: { type: "string" },
                        position: { type: "string" },
                      },
                      required: ["id", "name", "position"],
                    },
                  },
                  required: ["assigned"],
                },
              ],
            },
          },
          required: ["statusCode", "task"],
        },
        TasksResponse: {
          type: "object",
          properties: {
            statusCode: { type: "integer", enum: [200] },
            tasks: { type: "array", items: { $ref: "#/components/schemas/TaskWithProject" } },
          },
          required: ["statusCode", "tasks"],
        },
        AgentsResponse: {
          type: "object",
          properties: {
            statusCode: { type: "integer", enum: [200] },
            agents: { type: "array", items: { $ref: "#/components/schemas/CompanyAgent" } },
          },
          required: ["statusCode", "agents"],
        },
        ProjectsResponse: {
          type: "object",
          properties: {
            statusCode: { type: "integer", enum: [200] },
            projects: { type: "array", items: { $ref: "#/components/schemas/ProjectWithTasks" } },
          },
          required: ["statusCode", "projects"],
        },
        ProjectResponse: {
          type: "object",
          properties: {
            statusCode: { type: "integer" },
            project: { $ref: "#/components/schemas/Project" },
          },
          required: ["statusCode", "project"],
        },
        ProjectWithTasksResponse: {
          type: "object",
          properties: {
            statusCode: { type: "integer", enum: [200] },
            project: { $ref: "#/components/schemas/ProjectWithTasks" },
          },
          required: ["statusCode", "project"],
        },
        DeleteAgentResponse: {
          type: "object",
          properties: {
            statusCode: { type: "integer", enum: [200] },
            agentId: { type: "string", format: "uuid" },
          },
          required: ["statusCode", "agentId"],
        },
        DeleteProjectResponse: {
          type: "object",
          properties: {
            statusCode: { type: "integer", enum: [200] },
            projectId: { type: "string", format: "uuid" },
          },
          required: ["statusCode", "projectId"],
        },
        DeleteTaskResponse: {
          type: "object",
          properties: {
            statusCode: { type: "integer", enum: [200] },
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
          description: "Stable API identifier for the acting agent, such as main, ume, or review-agent-01. This is not the agent database UUID.",
          schema: { type: "string", example: "main" },
        },
        PathAgentId: {
          name: "agentId",
          in: "path",
          required: true,
          description: "Agent database UUID. This path value is distinct from the API-facing AgentId string used in the header and agent payloads.",
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
  apis: ["./app/api/agent/**/*.ts", "./app/api/agent/route.ts"],
})

export function GET() {
  return NextResponse.json(openApiDocument)
}
