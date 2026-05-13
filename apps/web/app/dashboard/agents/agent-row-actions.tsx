"use client"

import { useActionState, useState } from "react"
import { useFormStatus } from "react-dom"
import { MoreHorizontalIcon } from "lucide-react"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

import { deleteAgentAction, updateAgentAction } from "./actions"

type AgentRow = {
  id: string
  AgentId: string
  name: string
  description: string
  position: string
}

type AgentRowActionsProps = {
  agent: AgentRow
}

export function AgentRowActions({ agent }: AgentRowActionsProps) {
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [editState, editAction] = useActionState(updateAgentAction, {})
  const [deleteState, deleteAction] = useActionState(deleteAgentAction, {})

  return (
    <div className="flex justify-end gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="icon-sm" variant="ghost" type="button">
            <MoreHorizontalIcon />
            <span className="sr-only">Open agent actions</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>{agent.name}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setEditOpen(true)}>
            Edit agent
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => setDeleteOpen(true)}
          >
            Delete agent
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit agent</DialogTitle>
            <DialogDescription>
              Update this dashboard agent. AgentId is the stable API identity
              used in the AgentId header, so change it only when external
              clients can be updated too.
            </DialogDescription>
          </DialogHeader>
          <form action={editAction} className="space-y-4">
            <input name="agentId" type="hidden" value={agent.id} />
            <div className="space-y-2">
              <Label htmlFor={`agent-api-id-${agent.id}`}>AgentId</Label>
              <Input
                id={`agent-api-id-${agent.id}`}
                name="AgentId"
                defaultValue={agent.AgentId}
                required
              />
              <p className="text-xs text-muted-foreground">
                Must be unique. Existing API clients using the old AgentId
                header will need to switch.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor={`agent-name-${agent.id}`}>Name</Label>
              <Input
                id={`agent-name-${agent.id}`}
                name="name"
                defaultValue={agent.name}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`agent-position-${agent.id}`}>Position</Label>
              <Input
                id={`agent-position-${agent.id}`}
                name="position"
                defaultValue={agent.position}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`agent-description-${agent.id}`}>
                Description
              </Label>
              <Textarea
                id={`agent-description-${agent.id}`}
                name="description"
                defaultValue={agent.description}
                rows={4}
              />
            </div>
            {editState.error ? (
              <p className="text-sm text-destructive">
                {editState.error}
              </p>
            ) : null}
            <SaveAgentButton />
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {agent.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the agent. The company bearer token remains valid for
              other agents.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteState.error ? (
            <p className="text-sm text-destructive">
              {deleteState.error}
            </p>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <form action={deleteAction}>
              <input name="agentId" type="hidden" value={agent.id} />
              <DeleteAgentButton />
            </form>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function SaveAgentButton() {
  const { pending } = useFormStatus()

  return (
    <Button disabled={pending} type="submit">
      {pending ? "Saving..." : "Save changes"}
    </Button>
  )
}

function DeleteAgentButton() {
  const { pending } = useFormStatus()

  return (
    <AlertDialogAction
      disabled={pending}
      variant="destructive"
      type="submit"
    >
      {pending ? "Deleting..." : "Delete"}
    </AlertDialogAction>
  )
}
