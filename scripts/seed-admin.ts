import "dotenv/config"

import bcrypt from "bcryptjs"
import { PrismaPg } from "@prisma/adapter-pg"
import pg from "pg"
import { PrismaClient } from "../apps/web/generated/prisma/client"

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error("DATABASE_URL is not set")
}

const pool = new pg.Pool({ connectionString, connectionTimeoutMillis: 5_000 })
const prisma = new PrismaClient({
  adapter: new PrismaPg(pool, { disposeExternalPool: true }),
})

try {
  const username = "admin"
  const passwordHash = await bcrypt.hash("12345678", 12)

  await prisma.user.upsert({
    where: { username },
    update: { passwordHash },
    create: { username, passwordHash },
  })
} finally {
  await prisma.$disconnect()
}
