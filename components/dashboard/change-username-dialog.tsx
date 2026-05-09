"use client"

import { useState } from "react"
import { useMutation } from "@tanstack/react-query"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { apiJson } from "@/lib/api/client"

type ChangeUsernameDialogProps = {
  username: string
}

export function ChangeUsernameDialog({ username }: ChangeUsernameDialogProps) {
  const router = useRouter()
  const [message, setMessage] = useState<string | null>(null)
  const mutation = useMutation({
    mutationFn: (payload: { username: string; password: string }) =>
      apiJson<{ statusCode: 200 }>("/api/internal/account/username", {
        method: "PUT",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      setMessage("Username changed.")
      router.refresh()
    },
  })

  function action(formData: FormData) {
    setMessage(null)
    mutation.mutate({
      username: String(formData.get("username") ?? ""),
      password: String(formData.get("password") ?? ""),
    })
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button className="w-full" variant="outline" size="sm" type="button">
          Change username
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-2xl">Change username</DialogTitle>
          <DialogDescription>
            Update the username used to sign in to this dashboard.
          </DialogDescription>
        </DialogHeader>
        <form action={action} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="account-username">Username</Label>
            <Input
              id="account-username"
              name="username"
              type="text"
              autoComplete="username"
              defaultValue={username}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="username-password">Current password</Label>
            <Input
              id="username-password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </div>
          {mutation.error ? <p className="text-sm text-destructive">{mutation.error.message}</p> : null}
          {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
          <Button disabled={mutation.isPending} type="submit">
            {mutation.isPending ? "Changing..." : "Change username"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
