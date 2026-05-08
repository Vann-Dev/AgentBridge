"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
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
import { apiJson } from "@/lib/api/client"

type AgentRowActionsProps = {
  agent: {
    id: string
    name: string
  }
  companyId: string | null
}

export function AgentRowActions({ agent, companyId }: AgentRowActionsProps) {
  const queryClient = useQueryClient()
  const deleteMutation = useMutation({
    mutationFn: () =>
      apiJson(`/api/internal/agents/${agent.id}`, {
        method: "DELETE",
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["agents", companyId] }),
  })
  const tokenMutation = useMutation({
    mutationFn: () =>
      apiJson<{ token: string }>(`/api/internal/agents/${agent.id}/token`, {
        method: "POST",
      }),
  })

  return (
    <div className="flex justify-end gap-2">
      {tokenMutation.data?.token ? (
        <div className="max-w-80 rounded-2xl border border-border bg-muted p-3 text-left">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
            New token
          </p>
          <p className="mt-2 break-all font-mono text-xs">{tokenMutation.data.token}</p>
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
            <form action={() => tokenMutation.mutate()}>
              <button className="w-full text-left" disabled={tokenMutation.isPending} type="submit">
                {tokenMutation.isPending ? "Regenerating..." : "Regenerate token"}
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
              {deleteMutation.error ? (
                <p className="text-sm text-destructive">{deleteMutation.error.message}</p>
              ) : null}
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <form action={() => deleteMutation.mutate()}>
                  <AlertDialogAction
                    disabled={deleteMutation.isPending}
                    variant="destructive"
                    type="submit"
                  >
                    {deleteMutation.isPending ? "Deleting..." : "Delete"}
                  </AlertDialogAction>
                </form>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </DropdownMenuContent>
      </DropdownMenu>
      {tokenMutation.error ? (
        <p className="text-sm text-destructive">{tokenMutation.error.message}</p>
      ) : null}
    </div>
  )
}
