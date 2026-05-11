import { redirect } from "next/navigation"

import { getSession } from "@/lib/auth"
import { needsInitialSetup } from "@/lib/auth/setup"

export default async function Page() {
  const [session, shouldShowSetup] = await Promise.all([getSession(), needsInitialSetup()])

  if (session) {
    redirect("/dashboard")
  }

  if (shouldShowSetup) {
    redirect("/setup")
  }

  redirect("/login")
}
