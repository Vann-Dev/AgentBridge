import assert from "node:assert/strict"
import { fileURLToPath } from "node:url"
import { describe, it } from "node:test"
import { createOpenApiDocument } from "./openapi"

type OpenApiDocument = {
  paths?: Record<string, unknown>
  components?: {
    schemas?: Record<string, unknown>
  }
}

describe("OpenAPI document", () => {
  it("generates only Agent API paths from the web app working directory", () => {
    const originalCwd = process.cwd()
    process.chdir(fileURLToPath(new URL("../..", import.meta.url)))

    try {
      const document = createOpenApiDocument() as OpenApiDocument
      const paths = Object.keys(document.paths ?? {}).sort()

      assert.deepEqual(paths, [
      "/api/agent",
      "/api/agent/agents",
      "/api/agent/agents/{agentId}",
      "/api/agent/projects",
      "/api/agent/projects/{projectId}",
      "/api/agent/tasks",
        "/api/agent/tasks/{taskId}",
      ])
    } finally {
      process.chdir(originalCwd)
    }
  })

  it("exposes current task note, read, and dependency fields", () => {
    const document = createOpenApiDocument() as OpenApiDocument
    const taskSchema = document.components?.schemas?.Task as {
      properties?: Record<string, unknown>
    }

    assert.ok(taskSchema.properties?.note)
    assert.ok(taskSchema.properties?.summaryUpdatedAt)
    assert.ok(taskSchema.properties?.readBy)
    assert.ok(taskSchema.properties?.blockingReason)
    assert.ok(taskSchema.properties?.dependencies)
    assert.ok(taskSchema.properties?.unblocks)
  })
})
