"use client"

import { useActionState } from "react"
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

import { deleteAgent, regenerateAgentToken } from "./actions"

type AgentRowActionsProps = {
  agent: {
    id: string
    name: string
  }
}

export function AgentRowActions({ agent }: AgentRowActionsProps) {
  const [deleteResult, deleteAction, isDeleting] = useActionState(deleteAgent, null)
  const [tokenResult, tokenAction, isRegenerating] = useActionState(
    regenerateAgentToken,
    null
  )

  return (
    <div className="flex justify-end gap-2">
      {tokenResult?.token ? (
        <div className="max-w-80 rounded-2xl border border-border bg-muted p-3 text-left">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
            New token
          </p>
          <p className="mt-2 break-all font-mono text-xs">{tokenResult.token}</p>
        </div>
      ) : null}
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
          <DropdownMenuItem asChild>
            <form action={tokenAction}>
              <input name="agentId" type="hidden" value={agent.id} />
              <button className="w-full text-left" disabled={isRegenerating} type="submit">
                {isRegenerating ? "Regenerating..." : "Regenerate token"}
              </button>
            </form>
          </DropdownMenuItem>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <DropdownMenuItem variant="destructive" onSelect={(event) => event.preventDefault()}>
                Delete agent
              </DropdownMenuItem>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete {agent.name}?</AlertDialogTitle>
                <AlertDialogDescription>
                  This removes the agent and invalidates its bearer token. This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              {deleteResult?.error ? (
                <p className="text-sm text-destructive">{deleteResult.error}</p>
              ) : null}
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <form action={deleteAction}>
                  <input name="agentId" type="hidden" value={agent.id} />
                  <AlertDialogAction disabled={isDeleting} variant="destructive" type="submit">
                    {isDeleting ? "Deleting..." : "Delete"}
                  </AlertDialogAction>
                </form>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </DropdownMenuContent>
      </DropdownMenu>
      {tokenResult?.error ? <p className="text-sm text-destructive">{tokenResult.error}</p> : null}
    </div>
  )
}
