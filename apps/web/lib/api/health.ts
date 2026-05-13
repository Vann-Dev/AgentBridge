export type HealthResponse = {
  statusCode: 200 | 503
  status: "healthy" | "degraded"
  checks: {
    app: "ok"
    database: "ok" | "unavailable"
  }
}

export async function getHealthResponse(checkDatabase: () => Promise<unknown>) {
  const response: HealthResponse = {
    statusCode: 200,
    status: "healthy",
    checks: {
      app: "ok",
      database: "ok",
    },
  }

  try {
    await checkDatabase()
  } catch {
    response.statusCode = 503
    response.status = "degraded"
    response.checks.database = "unavailable"
  }

  return response
}
