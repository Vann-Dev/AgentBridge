import assert from "node:assert/strict"

import {
  agentApiRejectsInvalidAuth,
  internalApiRejectsMissingSession,
  responseTextLeaksBearerTokenHash,
} from "../apps/web/lib/api/auth-smoke"
import { getHealthResponse } from "../apps/web/lib/api/health"

async function main() {
  const healthy = await getHealthResponse(async () => undefined)
  assert.equal(healthy.statusCode, 200)
  assert.equal(healthy.status, "healthy")
  assert.equal(healthy.checks.database, "ok")

  const degraded = await getHealthResponse(async () => {
    throw new Error("database unavailable")
  })
  assert.equal(degraded.statusCode, 503)
  assert.equal(degraded.status, "degraded")
  assert.equal(degraded.checks.database, "unavailable")

  const internalRejected = await internalApiRejectsMissingSession(async () => ({
    response: {
      status: 401,
      body: { statusCode: 401, error: "Unauthorized" },
    },
  }))
  assert.equal(internalRejected, true)

  const agentRejected = await agentApiRejectsInvalidAuth(async () => null)
  assert.equal(agentRejected, true)

  const safeAgentResponse = {
    statusCode: 200,
    agent: {
      id: "agent-id",
      AgentId: "kaito",
      name: "Kaito",
      company: {
        id: "company-id",
        name: "NotAnOrdinary Lab",
      },
    },
  }
  assert.equal(responseTextLeaksBearerTokenHash(safeAgentResponse), false)

  const unsafeAgentResponse = {
    statusCode: 200,
    agent: {
      company: {
        bearerTokenHash: "secret-hash",
      },
    },
  }
  assert.equal(responseTextLeaksBearerTokenHash(unsafeAgentResponse), true)

  console.log("PASS smoke-auth-health")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
