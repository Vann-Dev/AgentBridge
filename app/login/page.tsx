import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

import { LoginForm } from "./login-form"

export default function LoginPage() {
  return (
    <main className="grid min-h-svh place-items-center bg-[radial-gradient(circle_at_top_left,var(--color-primary)_0,transparent_32rem)] p-6">
      <Card className="w-full max-w-sm bg-card/95 shadow-2xl shadow-primary/10 backdrop-blur">
        <CardHeader>
          <p className="text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">
            AgentBridge
          </p>
          <CardTitle className="text-2xl">Sign in</CardTitle>
          <CardDescription>
            Use the seeded admin account to enter the workspace.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm />
          <p className="mt-5 rounded-2xl bg-muted px-3 py-2 font-mono text-xs text-muted-foreground">
            admin / 12345678
          </p>
        </CardContent>
      </Card>
    </main>
  )
}
