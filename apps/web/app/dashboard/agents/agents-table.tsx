"use client"

import { useActionState, useEffect, useRef } from "react"
import { useFormStatus } from "react-dom"

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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"

import { createAgentAction } from "./actions"
import { AgentRowActions } from "./agent-row-actions"

type AgentRow = {
  id: string
  AgentId: string
  name: string
  description: string
  position: string
}

type AgentsTableProps = {
  agents: AgentRow[]
  companyId: string | null
}

export function AgentsTable({ agents, companyId }: AgentsTableProps) {
  const formRef = useRef<HTMLFormElement>(null)
  const [state, formAction] = useActionState(createAgentAction, {})

  useEffect(() => {
    if (!state.error) {
      formRef.current?.reset()
    }
  }, [state])

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold">Agents</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            People or AI workers assigned to project tasks.
          </p>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button disabled={!companyId} type="button">
              New agent
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-2xl">Create agent</DialogTitle>
              <DialogDescription>
                The company bearer token is shared. Enter the AgentId this agent will send in the AgentId header.
              </DialogDescription>
            </DialogHeader>
            <form ref={formRef} action={formAction} className="space-y-4">
              <input name="companyId" type="hidden" value={companyId ?? ""} />
              <div className="space-y-2">
                <Label htmlFor="agent-agent-id">AgentId</Label>
                <Input id="agent-agent-id" name="AgentId" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="agent-name">Name</Label>
                <Input id="agent-name" name="name" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="agent-position">Position</Label>
                <Input id="agent-position" name="position" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="agent-description">Description</Label>
                <Textarea id="agent-description" name="description" rows={4} />
              </div>
              {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
              <CreateAgentButton disabled={!companyId} />
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border">
        <Table>
          <TableHeader className="bg-muted text-xs uppercase tracking-[0.16em] text-muted-foreground">
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>AgentId</TableHead>
              <TableHead>Position</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {agents.length ? (
              agents.map((agent) => (
                <TableRow key={agent.id}>
                  <TableCell className="font-medium">{agent.name}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {agent.AgentId}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{agent.position}</TableCell>
                  <TableCell className="text-muted-foreground">{agent.description}</TableCell>
                  <TableCell className="text-right">
                    <AgentRowActions agent={agent} />
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell className="py-8 text-center text-muted-foreground" colSpan={5}>
                  No agents yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

function CreateAgentButton({ disabled }: { disabled?: boolean }) {
  const { pending } = useFormStatus()

  return (
    <Button disabled={pending || disabled} type="submit">
      {pending ? "Creating..." : "Create agent"}
    </Button>
  )
}
