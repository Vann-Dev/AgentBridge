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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { apiJson } from "@/lib/api/client"


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
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: (payload: {
      projectId: string
      assignedAgentId: string
      name: string
      job: string
      status: string
      note: string
      natsukiReadAt: string | null
      blockingReason: string
    }) =>
      apiJson("/api/internal/tasks", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["project", projectId] }),
  })

  function action(formData: FormData) {
    mutation.mutate({
      projectId,
      assignedAgentId: String(formData.get("assignedAgentId") ?? ""),
      name: String(formData.get("name") ?? ""),
      job: String(formData.get("job") ?? ""),
      status: String(formData.get("status") ?? "todo"),
      note: String(formData.get("note") ?? ""),
      natsukiReadAt: formData.get("natsukiReadAt") ? new Date().toISOString() : null,
      blockingReason: String(formData.get("blockingReason") ?? ""),
    })
  }

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
            <Label htmlFor="task-note">Done summary / note</Label>
            <Textarea
              id="task-note"
              name="note"
              placeholder="Summarize what changed when this task is done"
              rows={3}
            />
          </div>
          <div className="flex items-center justify-between gap-3 rounded-2xl border p-3 text-sm">
            <div>
              <Label htmlFor="task-natsuki-read">Natsuki/main read marker</Label>
              <p className="text-muted-foreground">Mark only after Natsuki/main has reviewed it.</p>
            </div>
            <input
              id="task-natsuki-read"
              name="natsukiReadAt"
              type="checkbox"
              className="size-4 accent-primary"
            />
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
          {mutation.error ? <p className="text-sm text-destructive">{mutation.error.message}</p> : null}
          {!agents.length ? (
            <p className="text-sm text-muted-foreground">Create an agent before adding tasks.</p>
          ) : null}
          <Button disabled={mutation.isPending || !agents.length} type="submit">
            {mutation.isPending ? "Creating..." : "Create task"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
