import { redirect } from "next/navigation"

import { hasExistingUser } from "@/lib/auth/setup"

export const dynamic = "force-dynamic"

export default async function Page() {
  if (!(await hasExistingUser())) {
    redirect("/setup")
  }

  redirect("/dashboard")
}
