"use client"

import { useState } from "react"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { apiJson } from "@/lib/api/client"

type CompanySettingsFormProps = {
  company: {
    id: string
    name: string
    description: string
  }
}

export function CompanySettingsForm({ company }: CompanySettingsFormProps) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [deleteConfirmation, setDeleteConfirmation] = useState("")
  const updateMutation = useMutation({
    mutationFn: (payload: { name: string; description: string }) =>
      apiJson<{ company: CompanySettingsFormProps["company"] }>(
        `/api/internal/companies/${company.id}`,
        {
          method: "PATCH",
          body: JSON.stringify(payload),
        }
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["companies"] })
      router.refresh()
    },
  })
  const deleteMutation = useMutation({
    mutationFn: () =>
      apiJson<{ companyId: string }>(`/api/internal/companies/${company.id}`, {
        method: "DELETE",
        body: JSON.stringify({ confirmationName: deleteConfirmation }),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["companies"] })
      router.push("/dashboard")
      router.refresh()
    },
  })
  const tokenMutation = useMutation({
    mutationFn: () =>
      apiJson<{ token: string }>(`/api/internal/companies/${company.id}`, {
        method: "POST",
        body: JSON.stringify({ confirmRotation: true }),
      }),
  })

  function updateCompany(formData: FormData) {
    updateMutation.mutate({
      name: String(formData.get("name") ?? ""),
      description: String(formData.get("description") ?? ""),
    })
  }

  return (
    <div className="space-y-6">
      <form action={updateCompany} className="space-y-4 rounded-3xl border border-border bg-card p-6 shadow-sm">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Company settings</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Update the active company name and description.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="company-name">Name</Label>
          <Input id="company-name" name="name" defaultValue={company.name} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="company-description">Description</Label>
          <Textarea
            id="company-description"
            name="description"
            defaultValue={company.description}
            rows={4}
          />
        </div>
        {updateMutation.error ? (
          <p className="text-sm text-destructive">{updateMutation.error.message}</p>
        ) : null}
        {updateMutation.isSuccess ? (
          <p className="text-sm text-muted-foreground">Company updated.</p>
        ) : null}
        <Button disabled={updateMutation.isPending} type="submit">
          {updateMutation.isPending ? "Saving..." : "Save changes"}
        </Button>
      </form>

      <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
        <h2 className="text-2xl font-semibold tracking-tight">Company bearer token</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Rotate the company-level token for external agent API access. Requests must also send the
          agent&apos;s unique AgentId in the AgentId header.
        </p>
        <p className="mt-3 max-w-2xl rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
          Rotating this token immediately invalidates existing external agent configs. The new token
          is shown once, so copy it into your agent config before leaving this page.
        </p>
        {tokenMutation.data?.token ? (
          <div className="mt-4 rounded-2xl border border-border bg-muted p-3">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
              New company bearer token · copy now
            </p>
            <p className="mt-2 break-all font-mono text-xs">{tokenMutation.data.token}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              This token cannot be viewed again. Update `.openclaw/agentbridge/.env` or any other
              external agent configuration that uses the old token.
            </p>
          </div>
        ) : null}
        {tokenMutation.error ? (
          <p className="mt-4 text-sm text-destructive">{tokenMutation.error.message}</p>
        ) : null}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button className="mt-5" disabled={tokenMutation.isPending} type="button">
              Rotate company token
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Rotate company bearer token?</AlertDialogTitle>
              <AlertDialogDescription>
                Existing external agents will stop authenticating until their configs are updated.
                The replacement token is displayed once after rotation.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={tokenMutation.isPending}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                disabled={tokenMutation.isPending}
                onClick={() => tokenMutation.mutate()}
              >
                {tokenMutation.isPending ? "Rotating..." : "Rotate token"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <div className="rounded-3xl border border-destructive/30 bg-card p-6 shadow-sm">
        <h2 className="text-2xl font-semibold tracking-tight">Delete company</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Delete this company and all agents, projects, tasks, audit logs, and agent API access in
          it. This cannot be undone. AgentBridge does not provide an in-app export or automatic
          restore; make a database backup first if you need to preserve records.
        </p>
        {deleteMutation.error ? (
          <p className="mt-4 text-sm text-destructive">{deleteMutation.error.message}</p>
        ) : null}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button className="mt-5" variant="destructive" type="button">
              Delete company
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete {company.name}?</AlertDialogTitle>
              <AlertDialogDescription>
                This permanently deletes the company, agents, projects, tasks, audit logs, and API
                token access. Type <span className="font-semibold text-foreground">{company.name}</span>{" "}
                to confirm. Back up the database first if you need to preserve this data.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-2">
              <Label htmlFor="delete-company-confirmation">Company name</Label>
              <Input
                id="delete-company-confirmation"
                value={deleteConfirmation}
                onChange={(event) => setDeleteConfirmation(event.target.value)}
                placeholder={company.name}
              />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleteMutation.isPending}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                disabled={deleteMutation.isPending || deleteConfirmation.trim() !== company.name}
                variant="destructive"
                onClick={() => deleteMutation.mutate()}
              >
                {deleteMutation.isPending ? "Deleting..." : "Delete company"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  )
}
