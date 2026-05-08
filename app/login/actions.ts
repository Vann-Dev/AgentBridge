"use server"

import bcrypt from "bcryptjs"
import { redirect } from "next/navigation"

import { createSession } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function login(_state: string | null, formData: FormData) {
  const username = String(formData.get("username") ?? "").trim()
  const password = String(formData.get("password") ?? "")

  if (!username || !password) {
    return "Enter username and password."
  }

  const user = await prisma.user.findUnique({
    where: { username },
  })

  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return "Invalid username or password."
  }

  await createSession({ userId: user.id, username: user.username })
  redirect("/dashboard")
}
