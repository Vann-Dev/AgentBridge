import { headers } from "next/headers"

import { prisma } from "@/lib/prisma"

const windowMs = 15 * 60 * 1000
const maxFailedAttempts = 5
const lockoutMs = 15 * 60 * 1000
const usernameMaxLength = 191
const ipMaxLength = 128
const unknownIp = "unknown"

type LoginThrottleTarget = {
  username: string
  ipAddress: string
}

export type LoginThrottleResult = {
  limited: boolean
  retryAfterSeconds?: number
}

export async function getLoginThrottleTarget(username: string): Promise<LoginThrottleTarget> {
  const headerStore = await headers()

  return {
    username: normalizeUsername(username),
    ipAddress: normalizeIpAddress(getClientIp(headerStore)),
  }
}

export async function checkLoginThrottle({
  username,
  ipAddress,
}: LoginThrottleTarget): Promise<LoginThrottleResult> {
  const now = new Date()
  const windowStartedAt = new Date(now.getTime() - windowMs)

  const throttle = await prisma.loginThrottle.findUnique({
    where: { username_ipAddress: { username, ipAddress } },
  })

  if (!throttle) return { limited: false }

  if (throttle.lockedUntil && throttle.lockedUntil > now) {
    return {
      limited: true,
      retryAfterSeconds: secondsUntil(throttle.lockedUntil, now),
    }
  }

  if (throttle.lastFailedAt < windowStartedAt) {
    return { limited: false }
  }

  if (throttle.failedAttempts >= maxFailedAttempts) {
    return {
      limited: true,
      retryAfterSeconds: Math.ceil(lockoutMs / 1000),
    }
  }

  return { limited: false }
}

export async function recordFailedLoginAttempt({ username, ipAddress }: LoginThrottleTarget) {
  const now = new Date()
  const windowStartedAt = new Date(now.getTime() - windowMs)

  await prisma.$transaction(async (tx) => {
    const throttle = await tx.loginThrottle.findUnique({
      where: { username_ipAddress: { username, ipAddress } },
    })

    const failedAttempts = throttle && throttle.lastFailedAt >= windowStartedAt
      ? throttle.failedAttempts + 1
      : 1
    const lockedUntil = failedAttempts >= maxFailedAttempts
      ? new Date(now.getTime() + lockoutMs)
      : null

    await tx.loginThrottle.upsert({
      where: { username_ipAddress: { username, ipAddress } },
      create: {
        username,
        ipAddress,
        failedAttempts,
        lastFailedAt: now,
        lockedUntil,
      },
      update: {
        failedAttempts,
        lastFailedAt: now,
        lockedUntil,
      },
    })
  })
}

export async function clearLoginThrottle({ username, ipAddress }: LoginThrottleTarget) {
  await prisma.loginThrottle.deleteMany({
    where: { username, ipAddress },
  })
}

export function formatLoginThrottleMessage(result: LoginThrottleResult) {
  if (!result.limited) return null

  const waitMinutes = Math.max(1, Math.ceil((result.retryAfterSeconds ?? 60) / 60))
  return `Too many sign-in attempts. Try again in ${waitMinutes} minute${waitMinutes === 1 ? "" : "s"}.`
}

function getClientIp(headerStore: Headers) {
  const forwardedFor = headerStore.get("x-forwarded-for")?.split(",")[0]?.trim()
  if (forwardedFor) return forwardedFor

  const realIp = headerStore.get("x-real-ip")?.trim()
  if (realIp) return realIp

  const vercelForwardedFor = headerStore.get("x-vercel-forwarded-for")?.split(",")[0]?.trim()
  if (vercelForwardedFor) return vercelForwardedFor

  return unknownIp
}

function normalizeUsername(username: string) {
  return username.trim().toLowerCase().slice(0, usernameMaxLength)
}

function normalizeIpAddress(ipAddress: string) {
  return (ipAddress || unknownIp).slice(0, ipMaxLength)
}

function secondsUntil(target: Date, now: Date) {
  return Math.max(1, Math.ceil((target.getTime() - now.getTime()) / 1000))
}
