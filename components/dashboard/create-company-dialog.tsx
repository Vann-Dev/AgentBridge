"use client"

import type { ReactNode } from "react"

import { useMutation, useQueryClient } from "@tanstack/react-query"
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
import { Textarea } from "@/components/ui/textarea"
import { apiJson } from "@/lib/api/client"

type CreateCompanyDialogProps = {
  defaultOpen?: boolean
  trigger?: ReactNode
}

export function CreateCompanyDialog({
  defaultOpen = false,
  trigger,
}: CreateCompanyDialogProps) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: (payload: { name: string; description: string }) =>
      apiJson<{ company: { id: string }; token: string }>("/api/internal/companies", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: ["companies"] })
      if (!data.token) {
        router.push(`/dashboard?company=${data.company.id}`)
        router.refresh()
      }
    },
  })

  function action(formData: FormData) {
    mutation.mutate({
      name: String(formData.get("name") ?? ""),
      description: String(formData.get("description") ?? ""),
    })
  }

  return (
    <Dialog defaultOpen={defaultOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button className="w-full justify-start px-3" variant="ghost" type="button">
            Create company
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-2xl">Create company</DialogTitle>
          <DialogDescription>
            Add a company to group agents, projects, and tasks.
          </DialogDescription>
        </DialogHeader>
        <form action={action} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="company-name">Name</Label>
            <Input id="company-name" name="name" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="company-description">Description</Label>
            <Textarea id="company-description" name="description" rows={4} />
          </div>
          {mutation.error ? <p className="text-sm text-destructive">{mutation.error.message}</p> : null}
          {mutation.data?.token ? (
            <div className="rounded-2xl border border-border bg-muted p-3">
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                Company bearer token
              </p>
              <p className="mt-2 break-all font-mono text-xs">{mutation.data.token}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                Store this now. You can generate a new token later from company settings.
              </p>
            </div>
          ) : null}
          <Button disabled={mutation.isPending} type="submit">
            {mutation.isPending ? "Creating..." : "Create company"}
          </Button>
          {mutation.data?.company.id ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                router.push(`/dashboard?company=${mutation.data.company.id}`)
                router.refresh()
              }}
            >
              Continue
            </Button>
          ) : null}
        </form>
      </DialogContent>
    </Dialog>
  )
}
