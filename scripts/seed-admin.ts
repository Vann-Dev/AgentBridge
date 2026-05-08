import "dotenv/config"

import bcrypt from "bcryptjs"
import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "../generated/prisma/client"

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error("DATABASE_URL is not set")
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
})

const username = "admin"
const passwordHash = await bcrypt.hash("12345678", 12)

await prisma.user.upsert({
  where: { username },
  update: { passwordHash },
  create: { username, passwordHash },
})

await prisma.$disconnect()
