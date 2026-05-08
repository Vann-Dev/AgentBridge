"use client"

import { useActionState } from "react"

import { createCompany } from "@/app/dashboard/companies/actions"
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

type CreateCompanyDialogProps = {
  defaultOpen?: boolean
}

export function CreateCompanyDialog({ defaultOpen = false }: CreateCompanyDialogProps) {
  const [error, action, isPending] = useActionState(createCompany, null)

  return (
    <Dialog defaultOpen={defaultOpen}>
      <DialogTrigger asChild>
        <Button className="w-full justify-start px-3" variant="ghost" type="button">
          Create company
        </Button>
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
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button disabled={isPending} type="submit">
            {isPending ? "Creating..." : "Create company"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
