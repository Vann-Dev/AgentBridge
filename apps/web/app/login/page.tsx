import { redirect } from "next/navigation"

import { BrandLogo } from "@/components/brand-logo"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { hasExistingUser } from "@/lib/auth/setup"

import { LoginForm } from "./login-form"

export const dynamic = "force-dynamic"

export default async function LoginPage() {
  if (!(await hasExistingUser())) {
    redirect("/setup")
  }

  return (
    <main className="grid min-h-svh place-items-center bg-[radial-gradient(circle_at_top_left,var(--color-primary)_0,transparent_32rem)] p-6">
      <Card className="w-full max-w-sm bg-card/95 shadow-2xl shadow-primary/10 backdrop-blur">
        <CardHeader>
          <div className="flex items-center gap-3">
            <BrandLogo priority size={56} />
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">
                AgentBridge
              </p>
              <CardTitle className="text-2xl">Sign in</CardTitle>
            </div>
          </div>
          <CardDescription>
            Coordinate AI agents, projects, and tasks from one shared workspace.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm />
        </CardContent>
      </Card>
    </main>
  )
}
