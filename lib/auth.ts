import { cookies } from "next/headers"
import { SignJWT, jwtVerify } from "jose"

const sessionCookieName = "agentbridge_session"
const sessionDuration = "7d"

type SessionPayload = {
  userId: string
  username: string
}

function getAuthSecret() {
  const secret = process.env.AUTH_SECRET

  if (!secret) {
    throw new Error("AUTH_SECRET is not set")
  }

  return new TextEncoder().encode(secret)
}

export async function createSession(payload: SessionPayload) {
  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(sessionDuration)
    .sign(getAuthSecret())

  const cookieStore = await cookies()
  cookieStore.set(sessionCookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  })
}

export async function getSession() {
  const cookieStore = await cookies()
  const token = cookieStore.get(sessionCookieName)?.value

  if (!token) {
    return null
  }

  try {
    const { payload } = await jwtVerify(token, getAuthSecret())

    if (typeof payload.userId !== "string" || typeof payload.username !== "string") {
      return null
    }

    return {
      userId: payload.userId,
      username: payload.username,
    }
  } catch {
    return null
  }
}

export async function destroySession() {
  const cookieStore = await cookies()
  cookieStore.delete(sessionCookieName)
}
