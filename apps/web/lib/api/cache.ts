import { Redis } from "@upstash/redis"

const DEFAULT_CACHE_NAMESPACE = "agentbridge"

const cacheRedis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      })
    : null

export const cacheTtl = {
  dashboardSummary: 20,
  dashboardBrief: 20,
  projectList: 30,
  projectDetail: 15,
  agentList: 30,
  notes: 15,
} as const

type CacheResult<T> = {
  value: T
  cacheStatus: "hit" | "miss" | "disabled"
}

export function isResponseCacheEnabled() {
  return Boolean(cacheRedis)
}

export async function getCachedJson<T>(key: string): Promise<T | null> {
  if (!cacheRedis) return null

  try {
    return await cacheRedis.get<T>(key)
  } catch (error) {
    logCacheError("read", error)
    return null
  }
}

export async function setCachedJson<T>(
  key: string,
  value: T,
  ttlSeconds: number
) {
  if (!cacheRedis) return

  try {
    await cacheRedis.set(key, value, { ex: ttlSeconds })
  } catch (error) {
    logCacheError("write", error)
  }
}

export async function cacheJson<T>(
  key: string,
  ttlSeconds: number,
  load: () => Promise<T>
): Promise<CacheResult<T>> {
  if (!isResponseCacheEnabled()) {
    return { value: await load(), cacheStatus: "disabled" }
  }

  const cached = await getCachedJson<T>(key)

  if (cached) {
    return { value: cached, cacheStatus: "hit" }
  }

  const value = await load()
  await setCachedJson(key, value, ttlSeconds)

  return { value, cacheStatus: "miss" }
}

export async function getCompanyCacheVersion(companyId: string) {
  if (!cacheRedis) return "0"

  try {
    return String(
      (await cacheRedis.get<number | string | null>(companyVersionKey(companyId))) ??
        "0"
    )
  } catch (error) {
    logCacheError("company version read", error)
    return "0"
  }
}

export async function getProjectCacheVersion(projectId: string) {
  if (!cacheRedis) return "0"

  try {
    return String(
      (await cacheRedis.get<number | string | null>(projectVersionKey(projectId))) ??
        "0"
    )
  } catch (error) {
    logCacheError("project version read", error)
    return "0"
  }
}

export async function invalidateCompanyCache(companyId: string) {
  if (!cacheRedis) return

  try {
    await cacheRedis.incr(companyVersionKey(companyId))
  } catch (error) {
    logCacheError("company invalidation", error)
  }
}

export async function invalidateProjectCache(projectId: string) {
  if (!cacheRedis) return

  try {
    await cacheRedis.incr(projectVersionKey(projectId))
  } catch (error) {
    logCacheError("project invalidation", error)
  }
}

export async function invalidateProjectAndCompanyCache({
  companyId,
  projectId,
}: {
  companyId: string
  projectId?: string | null
}) {
  await Promise.all([
    invalidateCompanyCache(companyId),
    projectId ? invalidateProjectCache(projectId) : Promise.resolve(),
  ])
}

export function cacheKey(parts: Array<string | number | null | undefined>) {
  return [
    DEFAULT_CACHE_NAMESPACE,
    ...parts.map((part) => String(part ?? "none")),
  ].join(":")
}

export function cacheStatusHeader(cacheStatus: CacheResult<unknown>["cacheStatus"]) {
  return cacheStatus
}

function companyVersionKey(companyId: string) {
  return cacheKey(["v", "company", companyId])
}

function projectVersionKey(projectId: string) {
  return cacheKey(["v", "project", projectId])
}

function logCacheError(operation: string, error: unknown) {
  console.warn(`[cache] Redis ${operation} failed; continuing without cache.`, {
    error: error instanceof Error ? error.message : String(error),
  })
}
