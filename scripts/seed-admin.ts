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

if (process.env.NODE_ENV === "production") {
  throw new Error("The admin seed script is for local development only.")
}

const username = process.env.SEED_ADMIN_USERNAME ?? "admin"
const password = process.env.SEED_ADMIN_PASSWORD ?? "12345678"
const passwordHash = await bcrypt.hash(password, 12)

await prisma.user.upsert({
  where: { username },
  update: { passwordHash },
  create: { username, passwordHash },
})

console.log(
  "Seeded local development admin user. Set SEED_ADMIN_USERNAME and SEED_ADMIN_PASSWORD to override defaults."
)

await prisma.$disconnect()
