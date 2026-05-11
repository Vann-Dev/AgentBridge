import "server-only"

import bcrypt from "bcryptjs"

import { prisma } from "@/lib/prisma"

type UserReader = {
  user: {
    findFirst: (args: { select: { id: true } }) => Promise<{ id: string } | null>
  }
}

export async function needsInitialSetup(client: UserReader = prisma) {
  const firstUser = await client.user.findFirst({
    select: { id: true },
  })

  return !firstUser
}

export function validateSetupCredentials(username: string, password: string) {
  if (!username) {
    return "Username is required."
  }

  if (username.length < 3) {
    return "Username must be at least 3 characters."
  }

  if (username.length > 64) {
    return "Username must be 64 characters or fewer."
  }

  if (!/^[a-zA-Z0-9._-]+$/.test(username)) {
    return "Username can only include letters, numbers, dots, underscores, and hyphens."
  }

  if (!password) {
    return "Password is required."
  }

  if (password.length < 8) {
    return "Password must be at least 8 characters."
  }

  return null
}

export async function createInitialOwner(username: string, password: string) {
  return prisma.$transaction(
    async (tx) => {
      if (!(await needsInitialSetup(tx))) {
        throw new Error("Setup has already been completed.")
      }

      const passwordHash = await bcrypt.hash(password, 12)

      return tx.user.create({
        data: {
          username,
          passwordHash,
        },
      })
    },
    { isolationLevel: "Serializable" }
  )
}
