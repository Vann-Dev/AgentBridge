"use client"

import { useActionState } from "react"

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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

import { createTask } from "./actions"

type AgentOption = {
  id: string
  name: string
  position: string
}

type CreateTaskDialogProps = {
  projectId: string
  agents: AgentOption[]
}

export function CreateTaskDialog({ projectId, agents }: CreateTaskDialogProps) {
  const [result, action, isPending] = useActionState(createTask, null)

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button disabled={!agents.length} type="button">
          New task
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-2xl">Create task</DialogTitle>
          <DialogDescription>
            Add a task and assign it to an agent in this company.
          </DialogDescription>
        </DialogHeader>
        <form action={action} className="space-y-4">
          <input name="projectId" type="hidden" value={projectId} />
          <div className="space-y-2">
            <Label htmlFor="task-name">Name</Label>
            <Input id="task-name" name="name" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="task-job">Job</Label>
            <Textarea id="task-job" name="job" rows={4} required />
          </div>
          <div className="space-y-2">
            <Label>Assigned agent</Label>
            <Select name="assignedAgentId" required>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select agent" />
              </SelectTrigger>
              <SelectContent>
                {agents.map((agent) => (
                  <SelectItem key={agent.id} value={agent.id}>
                    {agent.name} · {agent.position}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select name="status" defaultValue="todo">
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todo">Todo</SelectItem>
                <SelectItem value="inprogress">In progress</SelectItem>
                <SelectItem value="blocked">Blocked</SelectItem>
                <SelectItem value="done">Done</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="task-blocking-reason">Blocking reason</Label>
            <Textarea
              id="task-blocking-reason"
              name="blockingReason"
              placeholder="Only needed if blocked"
              rows={3}
            />
          </div>
          {result?.error ? <p className="text-sm text-destructive">{result.error}</p> : null}
          {!agents.length ? (
            <p className="text-sm text-muted-foreground">Create an agent before adding tasks.</p>
          ) : null}
          <Button disabled={isPending || !agents.length} type="submit">
            {isPending ? "Creating..." : "Create task"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
