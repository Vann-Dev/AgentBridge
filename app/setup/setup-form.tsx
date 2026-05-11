"use client"

import { useActionState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

import { createOwner } from "./actions"

export function SetupForm() {
  const [error, action, isPending] = useActionState(createOwner, null)

  return (
    <form action={action} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="username">Owner username</Label>
        <Input
          id="username"
          name="username"
          type="text"
          autoComplete="username"
          placeholder="admin"
          required
        />
        <p className="text-xs text-muted-foreground">
          Use 3-64 letters, numbers, dots, underscores, or hyphens.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
        <p className="text-xs text-muted-foreground">Use at least 8 characters.</p>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button className="w-full" disabled={isPending} type="submit">
        {isPending ? "Creating owner..." : "Create owner account"}
      </Button>
    </form>
  )
}
