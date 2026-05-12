import { redirect } from "next/navigation"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { hasExistingUser } from "@/lib/auth/setup"

import { SetupForm } from "./setup-form"

export const dynamic = "force-dynamic"

export default async function SetupPage() {
  if (await hasExistingUser()) {
    redirect("/login")
  }

  return (
    <main className="grid min-h-svh place-items-center bg-[radial-gradient(circle_at_top_left,var(--color-primary)_0,transparent_32rem)] p-6">
      <Card className="w-full max-w-md bg-card/95 shadow-2xl shadow-primary/10 backdrop-blur">
        <CardHeader>
          <p className="text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">
            AgentBridge setup
          </p>
          <CardTitle className="text-2xl">Create the first owner</CardTitle>
          <CardDescription>
            No user account exists yet. Create the initial owner account for this deployment. Setup
            closes automatically after the first user is created.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SetupForm />
        </CardContent>
      </Card>
    </main>
  )
}
