"use server"

import bcrypt from "bcryptjs"
import { redirect } from "next/navigation"

import { createSession } from "@/lib/auth"
import { createFirstUser, validateSetupCredentials } from "@/lib/auth/setup"

export async function setupFirstOwner(_state: string | null, formData: FormData) {
  const usernameInput = String(formData.get("username") ?? "")
  const passwordInput = String(formData.get("password") ?? "")

  const validation = validateSetupCredentials(usernameInput, passwordInput)

  if (!validation.ok) {
    return validation.message
  }

  const passwordHash = await bcrypt.hash(validation.password, 12)
  const result = await createFirstUser(validation.username, passwordHash)

  if (!result.created) {
    return "Setup is already complete. Sign in with an existing account."
  }

  await createSession({ userId: result.user.id, username: result.user.username })
  redirect("/dashboard")
}
