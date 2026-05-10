"use client"

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
          Generate one company-level token for API access. Requests must also send the agent&apos;s
          unique AgentId in the AgentId header.
        </p>
        {tokenMutation.data?.token ? (
          <div className="mt-4 rounded-2xl border border-border bg-muted p-3">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
              New company bearer token
            </p>
            <p className="mt-2 break-all font-mono text-xs">{tokenMutation.data.token}</p>
          </div>
        ) : null}
        {tokenMutation.error ? (
          <p className="mt-4 text-sm text-destructive">{tokenMutation.error.message}</p>
        ) : null}
        <Button
          className="mt-5"
          disabled={tokenMutation.isPending}
          type="button"
          onClick={() => tokenMutation.mutate()}
        >
          {tokenMutation.isPending ? "Generating..." : "Generate company token"}
        </Button>
      </div>

      <div className="rounded-3xl border border-destructive/30 bg-card p-6 shadow-sm">
        <h2 className="text-2xl font-semibold tracking-tight">Delete company</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Delete this company and all agents, projects, and tasks in it. This cannot be undone.
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
                This permanently deletes the company, agents, projects, and tasks.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleteMutation.isPending}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                disabled={deleteMutation.isPending}
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
