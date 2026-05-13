"use client"

import { useState, useTransition } from "react"

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

import { createProjectAction } from "./actions"


type CreateProjectDialogProps = {
  companyId: string | null
  onCreated?: (project: { id: string; name: string; description: string }) => void
}

export function CreateProjectDialog({
  companyId,
  onCreated,
}: CreateProjectDialogProps) {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function action(formData: FormData) {
    if (!companyId) return

    setError(null)
    startTransition(async () => {
      const result = await createProjectAction(formData)

      if (!result.ok) {
        setError(result.error)
        return
      }

      onCreated?.(result.project)
      setOpen(false)
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
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
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button disabled={isPending || !companyId} type="submit">
            {isPending ? "Creating..." : "Create project"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
