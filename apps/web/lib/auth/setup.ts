import "server-only"

import { Prisma } from "@/generated/prisma/client"
import { prisma } from "@/lib/prisma"

export const minimumSetupPasswordLength = 8

export type SetupValidationResult =
  | { ok: true; username: string; password: string }
  | { ok: false; message: string }

export async function hasExistingUser() {
  const userCount = await prisma.user.count({ take: 1 })
  return userCount > 0
}

export function validateSetupCredentials(usernameInput: string, passwordInput: string): SetupValidationResult {
  const username = usernameInput.trim()
  const password = passwordInput

  if (!username || !password) {
    return { ok: false, message: "Enter a username and password." }
  }

  if (username.length < 3) {
    return { ok: false, message: "Username must be at least 3 characters." }
  }

  if (username.length > 64) {
    return { ok: false, message: "Username must be 64 characters or fewer." }
  }

  if (!/^[a-zA-Z0-9._-]+$/.test(username)) {
    return {
      ok: false,
      message: "Username can only contain letters, numbers, dots, underscores, and hyphens.",
    }
  }

  if (password.length < minimumSetupPasswordLength) {
    return {
      ok: false,
      message: `Password must be at least ${minimumSetupPasswordLength} characters.`,
    }
  }

  return { ok: true, username, password }
}

export async function createFirstUser(username: string, passwordHash: string) {
  return prisma.$transaction(
    async (tx) => {
      const existingUser = await tx.user.findFirst({ select: { id: true } })

      if (existingUser) {
        return { created: false as const, user: null }
      }

      const user = await tx.user.create({
        data: { username, passwordHash },
        select: { id: true, username: true },
      })

      return { created: true as const, user }
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  )
}
