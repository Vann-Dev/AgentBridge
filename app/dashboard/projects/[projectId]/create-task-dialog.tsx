"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { Status } from "@/generated/prisma/enums"

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


type TaskOption = {
  id: string
  name: string
  status: Status
}

type AgentOption = {
  id: string
  name: string
  position: string
}

type CreateTaskDialogProps = {
  agents: AgentOption[]
  companyId: string
  projectId: string
}

export function CreateTaskDialog({ agents, companyId, projectId }: CreateTaskDialogProps) {
  const queryClient = useQueryClient()
  const projectQuery = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => apiJson<{ project: { tasks: TaskOption[] } }>(`/api/internal/projects/${projectId}`),
  })
  const dependencyOptions = projectQuery.data?.project.tasks ?? []
  const mutation = useMutation({
    mutationFn: (payload: {
      projectId: string
      assignedAgentId: string
      name: string
      job: string
      status: string
      note: string
      readByAgentIds: string[]
      blockingReason: string
      dependencyIds: string[]
    }) =>
      apiJson("/api/internal/tasks", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project", projectId] })
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary", companyId] })
      queryClient.invalidateQueries({ queryKey: ["projects", companyId] })
      queryClient.invalidateQueries({ queryKey: ["agents", companyId] })
    },
  })

  function action(formData: FormData) {
    mutation.mutate({
      projectId,
      assignedAgentId: String(formData.get("assignedAgentId") ?? ""),
      name: String(formData.get("name") ?? ""),
      job: String(formData.get("job") ?? ""),
      status: String(formData.get("status") ?? "todo"),
      note: String(formData.get("note") ?? ""),
      readByAgentIds: formData.getAll("readByAgentIds").map(String),
      blockingReason: String(formData.get("blockingReason") ?? ""),
      dependencyIds: formData.getAll("dependencyIds").map(String),
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
          <div className="space-y-3 rounded-2xl border p-3 text-sm">
            <div>
              <Label>Dependencies</Label>
              <p className="text-muted-foreground">Select tasks that must be done before this task is ready.</p>
            </div>
            {dependencyOptions.length ? (
              <div className="grid max-h-44 gap-2 overflow-auto pr-1 sm:grid-cols-2">
                {dependencyOptions.map((task) => (
                  <label key={task.id} className="flex items-start gap-2 rounded-xl bg-muted px-3 py-2">
                    <input name="dependencyIds" type="checkbox" value={task.id} className="mt-1 size-4 accent-primary" />
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{task.name}</span>
                      <span className="block text-xs text-muted-foreground">{task.status}</span>
                    </span>
                  </label>
                ))}
              </div>
            ) : (
              <p className="rounded-xl bg-muted px-3 py-2 text-muted-foreground">No existing tasks are available.</p>
            )}
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
          <div className="space-y-3 rounded-2xl border p-3 text-sm">
            <div>
              <Label>Read markers for initial status</Label>
              <p className="text-muted-foreground">Mark only agents who have already reviewed this task in its initial status.</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {agents.map((agent) => (
                <label key={agent.id} className="flex items-center gap-2 rounded-xl bg-muted px-3 py-2">
                  <input
                    name="readByAgentIds"
                    type="checkbox"
                    value={agent.id}
                    className="size-4 accent-primary"
                  />
                  <span>
                    <span className="font-medium">{agent.name}</span>
                    <span className="block text-xs text-muted-foreground">{agent.position}</span>
                  </span>
                </label>
              ))}
            </div>
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
