import "server-only"

import { config as loadEnv } from "dotenv"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "@/generated/prisma/client"

const workspaceEnvPath = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../.env",
)

loadEnv({ path: workspaceEnvPath })

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error("DATABASE_URL is not set")
}

type AgentBridgePrismaClient = InstanceType<typeof PrismaClient>

const globalForPrisma = globalThis as unknown as {
  prisma?: AgentBridgePrismaClient
}

const adapter = new PrismaPg({ connectionString })

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter })

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma
}
