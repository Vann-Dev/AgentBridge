type UnauthorizedResponse = {
  statusCode: 401
  error: "Unauthorized"
}

type InternalSessionResult = {
  response: { status: number; body: UnauthorizedResponse } | null
}

type AgentAuthResult = {
  id: string
  AgentId: string
  name: string
  company: Record<string, unknown>
} | null

export async function internalApiRejectsMissingSession(
  requireSession: () => Promise<InternalSessionResult>
) {
  const { response } = await requireSession()

  return response?.status === 401 && response.body.error === "Unauthorized"
}

export async function agentApiRejectsInvalidAuth(
  authenticate: () => Promise<AgentAuthResult>
) {
  return (await authenticate()) === null
}

export function responseTextLeaksBearerTokenHash(body: unknown) {
  return JSON.stringify(body).includes("bearerTokenHash")
}
