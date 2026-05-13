"use client"

import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { updateProjectAgentsAction } from "./actions"
import type { ProjectAgent } from "./types"

type ProjectAgentsManagerProps = {
  companyAgents: ProjectAgent[]
  companyId: string
  projectAgents: ProjectAgent[]
  projectId: string
}

export function ProjectAgentsManager({
  companyAgents,
  companyId,
  projectAgents,
  projectId,
}: ProjectAgentsManagerProps) {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [selectedAgentIds, setSelectedAgentIds] = useState(() =>
    projectAgents.map((agent) => agent.id)
  )
  const mutation = useMutation({
    mutationFn: (agentIds: string[]) =>
      updateProjectAgentsAction(projectId, agentIds).then((result) => {
        if (!result.ok) {
          throw new Error(result.error)
        }

        return result
      }),
    onSuccess: () => {
      setOpen(false)
      queryClient.invalidateQueries({ queryKey: ["project", projectId] })
      queryClient.invalidateQueries({
        queryKey: ["dashboard-summary", companyId],
      })
      queryClient.invalidateQueries({ queryKey: ["projects", companyId] })
    },
  })

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      setSelectedAgentIds(projectAgents.map((agent) => agent.id))
    }

    setOpen(nextOpen)
  }

  function action() {
    mutation.mutate(selectedAgentIds)
  }

  function updateSelectedAgent(agentId: string, checked: boolean) {
    setSelectedAgentIds((current) =>
      checked
        ? Array.from(new Set([...current, agentId]))
        : current.filter((selectedAgentId) => selectedAgentId !== agentId)
    )
  }

  return (
    <div className="rounded-2xl border bg-muted/30 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium">Project agents</p>
            <Badge variant="outline">{projectAgents.length}</Badge>
          </div>
          {projectAgents.length ? (
            <div className="flex flex-wrap gap-2">
              {projectAgents.map((agent) => (
                <Badge key={agent.id} variant="secondary">
                  {agent.name} · {agent.position}
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No agents are linked yet. Add project agents before creating
              tasks.
            </p>
          )}
        </div>
        <Dialog open={open} onOpenChange={handleOpenChange}>
          <DialogTrigger asChild>
            <Button type="button" variant="outline" size="sm">
              Manage agents
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-2xl">
                Manage project agents
              </DialogTitle>
              <DialogDescription>
                Choose which company agents are available for tasks in this
                project.
              </DialogDescription>
            </DialogHeader>
            <form action={action} className="space-y-4">
              <div className="space-y-3 rounded-2xl border p-3 text-sm">
                <Label>Company agents</Label>
                {companyAgents.length ? (
                  <div className="grid max-h-80 gap-2 overflow-auto pr-1 sm:grid-cols-2">
                    {companyAgents.map((agent) => (
                      <label
                        key={agent.id}
                        className="flex items-start gap-2 rounded-xl bg-muted px-3 py-2"
                      >
                        <input
                          name="agentIds"
                          type="checkbox"
                          value={agent.id}
                          checked={selectedAgentIds.includes(agent.id)}
                          onChange={(event) =>
                            updateSelectedAgent(agent.id, event.target.checked)
                          }
                          className="mt-1 size-4 accent-primary"
                        />
                        <span className="min-w-0">
                          <span className="block truncate font-medium">
                            {agent.name}
                          </span>
                          <span className="block text-xs text-muted-foreground">
                            {agent.AgentId} · {agent.position}
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <p className="rounded-xl bg-muted px-3 py-2 text-muted-foreground">
                    Create a company agent before linking project agents.
                  </p>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                The dialog closes after a successful save. Removing an agent
                does not delete or reassign existing tasks; it only prevents new
                assignments until the agent is linked again.
              </p>
              {mutation.error ? (
                <p className="text-sm text-destructive">
                  {mutation.error.message}
                </p>
              ) : null}
              <DialogFooter>
                <Button disabled={mutation.isPending} type="submit">
                  {mutation.isPending ? "Saving..." : "Save project agents"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
