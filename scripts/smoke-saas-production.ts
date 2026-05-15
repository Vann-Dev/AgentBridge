import assert from "node:assert/strict"

type JsonRecord = Record<string, unknown>

type SmokeConfig = {
  baseUrl: string
  companyToken: string
  agentId: string
  projectId: string
}

function requiredEnv(name: string) {
  const value = process.env[name]?.trim()

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }

  return value
}

function getConfig(): SmokeConfig {
  return {
    baseUrl: requiredEnv("AGENTBRIDGE_BASE_URL").replace(/\/$/, ""),
    companyToken: requiredEnv("AGENTBRIDGE_COMPANY_TOKEN"),
    agentId: requiredEnv("AGENTBRIDGE_AGENT_ID"),
    projectId: requiredEnv("AGENTBRIDGE_PROJECT_ID"),
  }
}

async function readJson(response: Response) {
  const text = await response.text()

  try {
    return JSON.parse(text) as JsonRecord
  } catch {
    throw new Error(
      `Expected JSON response from ${response.url}, got: ${text.slice(0, 200)}`
    )
  }
}

async function requestJson(
  config: SmokeConfig,
  path: string,
  init: RequestInit = {}
): Promise<{ response: Response; body: JsonRecord }> {
  const headers = new Headers(init.headers)
  headers.set("Accept", "application/json")
  headers.set("Authorization", `Bearer ${config.companyToken}`)
  headers.set("AgentId", config.agentId)

  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json")
  }

  const response = await fetch(`${config.baseUrl}${path}`, { ...init, headers })
  const body = await readJson(response)

  return { response, body }
}

function assertStatus(
  response: Response,
  body: JsonRecord,
  status: number,
  label: string
) {
  assert.equal(response.status, status, `${label} HTTP status`)
  assert.equal(body.statusCode, status, `${label} statusCode`)
}

function assertTask(body: JsonRecord) {
  assert.equal(typeof body.task, "object")
  assert.notEqual(body.task, null)

  return body.task as JsonRecord
}

async function main() {
  const config = getConfig()
  const runId = new Date().toISOString()
  const taskName = `SaaS smoke ${runId}`
  const note = `Smoke completed at ${runId}`

  const healthResponse = await fetch(`${config.baseUrl}/api/health`, {
    headers: { Accept: "application/json" },
  })
  const health = await readJson(healthResponse)
  assertStatus(healthResponse, health, 200, "health")
  assert.equal(health.status, "healthy")
  assert.equal((health.checks as JsonRecord | undefined)?.database, "ok")

  const agentResult = await requestJson(config, "/api/agent")
  assertStatus(agentResult.response, agentResult.body, 200, "agent profile")
  assert.equal(
    (agentResult.body.agent as JsonRecord | undefined)?.AgentId,
    config.agentId
  )

  const createResult = await requestJson(config, "/api/agent/tasks", {
    method: "POST",
    body: JSON.stringify({
      projectId: config.projectId,
      assignedAgentId: config.agentId,
      name: taskName,
      job: "Disposable task created by the scripted SaaS production smoke check.",
      status: "todo",
    }),
  })
  assertStatus(createResult.response, createResult.body, 201, "task create")
  const createdTask = assertTask(createResult.body)
  const taskId = String(createdTask.id)
  assert.equal(createdTask.name, taskName)
  assert.equal(createdTask.status, "todo")

  const listResult = await requestJson(config, "/api/agent/tasks")
  assertStatus(listResult.response, listResult.body, 200, "task list")
  assert.equal(Array.isArray(listResult.body.tasks), true)
  assert.equal(
    (listResult.body.tasks as JsonRecord[]).some((task) => task.id === taskId),
    true,
    "created task appears in task list"
  )

  const updateResult = await requestJson(config, `/api/agent/tasks/${taskId}`, {
    method: "PATCH",
    body: JSON.stringify({ status: "done", note, readBy: [config.agentId] }),
  })
  assertStatus(updateResult.response, updateResult.body, 200, "task update")
  const updatedTask = assertTask(updateResult.body)
  assert.equal(updatedTask.status, "done")
  assert.equal(updatedTask.note, note)
  assert.equal(Array.isArray(updatedTask.readBy), true)
  assert.equal((updatedTask.readBy as unknown[]).includes(config.agentId), true)
  assert.equal(typeof updatedTask.summaryUpdatedAt, "string")

  console.log(`PASS smoke-saas-production taskId=${taskId}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
