"use client"

import { useActionState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { setupFirstOwner } from "./actions"

const minimumSetupPasswordLength = 8

export function SetupForm() {
  const [error, action, isPending] = useActionState(setupFirstOwner, null)

  return (
    <form action={action} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="username">Owner username</Label>
        <Input
          id="username"
          name="username"
          type="text"
          autoComplete="username"
          minLength={3}
          maxLength={64}
          pattern="[a-zA-Z0-9._-]+"
          required
        />
        <p className="text-xs text-muted-foreground">
          Use letters, numbers, dots, underscores, or hyphens.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={minimumSetupPasswordLength}
          required
        />
        <p className="text-xs text-muted-foreground">
          Use at least {minimumSetupPasswordLength} characters. Store it in your password manager.
        </p>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button className="w-full" disabled={isPending} type="submit">
        {isPending ? "Creating owner..." : "Create owner account"}
      </Button>
    </form>
  )
}
