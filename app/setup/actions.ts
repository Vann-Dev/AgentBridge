"use server"

import { redirect } from "next/navigation"

import { createSession } from "@/lib/auth"
import { createInitialOwner, validateSetupCredentials } from "@/lib/auth/setup"

export async function createOwner(_state: string | null, formData: FormData) {
  const username = String(formData.get("username") ?? "").trim()
  const password = String(formData.get("password") ?? "")

  const validationError = validateSetupCredentials(username, password)

  if (validationError) {
    return validationError
  }

  try {
    const user = await createInitialOwner(username, password)
    await createSession({ userId: user.id, username: user.username })
  } catch (error) {
    if (error instanceof Error) {
      return error.message
    }

    return "Setup could not be completed."
  }

  redirect("/dashboard")
}
