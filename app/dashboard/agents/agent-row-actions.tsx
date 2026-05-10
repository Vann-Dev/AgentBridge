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
                  This removes the agent. The company bearer token remains valid for other agents.
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
    </div>
  )
}
