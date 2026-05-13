"use client"

import { useState } from "react"
import { useMutation } from "@tanstack/react-query"

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
import { changePasswordAction } from "@/app/dashboard/settings/actions"

export function ChangePasswordDialog() {
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const mutation = useMutation({
    mutationFn: (payload: { currentPassword: string; newPassword: string }) =>
      changePasswordAction(payload).then((result) => {
        if (!result.ok) {
          throw new Error(result.error)
        }

        return result
      }),
    onSuccess: () => {
      setMessage("Password changed.")
    },
  })

  function action(formData: FormData) {
    const newPassword = String(formData.get("newPassword") ?? "")
    const confirmPassword = String(formData.get("confirmPassword") ?? "")

    setMessage(null)

    if (newPassword !== confirmPassword) {
      setMessage("New passwords do not match.")
      return
    }

    mutation.mutate({
      currentPassword: String(formData.get("currentPassword") ?? ""),
      newPassword,
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="w-full" variant="outline" size="sm" type="button">
          Change password
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-2xl">Change password</DialogTitle>
          <DialogDescription>
            Update the password used to sign in to this dashboard.
          </DialogDescription>
        </DialogHeader>
        <form action={action} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="current-password">Current password</Label>
            <Input
              id="current-password"
              name="currentPassword"
              type="password"
              autoComplete="current-password"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-password">New password</Label>
            <Input
              id="new-password"
              name="newPassword"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirm new password</Label>
            <Input
              id="confirm-password"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </div>
          {mutation.error ? <p className="text-sm text-destructive">{mutation.error.message}</p> : null}
          {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
          <Button disabled={mutation.isPending} type="submit">
            {mutation.isPending ? "Changing..." : "Change password"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
