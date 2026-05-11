import { redirect } from "next/navigation"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getSession } from "@/lib/auth"
import { needsInitialSetup } from "@/lib/auth/setup"

import { SetupForm } from "./setup-form"

export default async function SetupPage() {
  const [session, shouldShowSetup] = await Promise.all([getSession(), needsInitialSetup()])

  if (session || !shouldShowSetup) {
    redirect("/dashboard")
  }

  return (
    <main className="grid min-h-svh place-items-center bg-[radial-gradient(circle_at_top_left,var(--color-primary)_0,transparent_32rem)] p-6">
      <Card className="w-full max-w-sm bg-card/95 shadow-2xl shadow-primary/10 backdrop-blur">
        <CardHeader>
          <p className="text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">
            AgentBridge
          </p>
          <CardTitle className="text-2xl">Create owner account</CardTitle>
          <CardDescription>
            This one-time setup appears only when no user accounts exist. Create the first owner
            account for this deployment.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SetupForm />
        </CardContent>
      </Card>
    </main>
  )
}
