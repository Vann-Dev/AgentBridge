import { NextResponse } from "next/server"
import swaggerJsdoc from "swagger-jsdoc"

const openApiDocument = swaggerJsdoc({
  definition: {
    openapi: "3.1.0",
    info: {
      title: "AgentBridge Agent API",
      version: "0.1.0",
    },
    servers: [{ url: "/" }],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
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
            name: { type: "string" },
            description: { type: "string" },
            position: { type: "string" },
            companyId: { type: "string", format: "uuid" },
          },
          required: ["id", "name", "description", "position", "companyId"],
        },
        CompanyAgent: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            name: { type: "string" },
            description: { type: "string" },
            position: { type: "string" },
            _count: {
              type: "object",
              properties: { tasks: { type: "integer" } },
              required: ["tasks"],
            },
          },
          required: ["id", "name", "description", "position", "_count"],
        },
        Task: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            name: { type: "string" },
            job: { type: "string" },
            status: { $ref: "#/components/schemas/Status" },
            blockingReason: { type: "string", nullable: true },
          },
          required: ["id", "name", "job", "status", "blockingReason"],
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
        TaskResponse: {
          type: "object",
          properties: {
            statusCode: { type: "integer", enum: [200] },
            task: { $ref: "#/components/schemas/TaskWithProject" },
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
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: ["./app/api/agent/**/*.ts", "./app/api/agent/route.ts"],
})

export function GET() {
  return NextResponse.json(openApiDocument)
}
