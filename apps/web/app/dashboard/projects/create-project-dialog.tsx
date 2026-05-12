"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"

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


type CreateProjectDialogProps = {
  companyId: string | null
}

export function CreateProjectDialog({ companyId }: CreateProjectDialogProps) {
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: (payload: { companyId: string; name: string; description: string }) =>
      apiJson("/api/internal/projects", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects", companyId] })
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary", companyId] })
    },
  })

  function action(formData: FormData) {
    if (!companyId) return

    mutation.mutate({
      companyId,
      name: String(formData.get("name") ?? ""),
      description: String(formData.get("description") ?? ""),
    })
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button disabled={!companyId} type="button">
          New project
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-2xl">Create project</DialogTitle>
          <DialogDescription>
            Add work for the active company and set its starting status.
          </DialogDescription>
        </DialogHeader>
        <form action={action} className="space-y-4">
          <input name="companyId" type="hidden" value={companyId ?? ""} />
          <div className="space-y-2">
            <Label htmlFor="project-name">Name</Label>
            <Input id="project-name" name="name" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="project-description">Description</Label>
            <Textarea id="project-description" name="description" rows={4} />
          </div>
          {mutation.error ? <p className="text-sm text-destructive">{mutation.error.message}</p> : null}
          <Button disabled={mutation.isPending || !companyId} type="submit">
            {mutation.isPending ? "Creating..." : "Create project"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
