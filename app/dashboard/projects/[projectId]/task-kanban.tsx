"use client"

import { useState } from "react"
import { ChevronDown } from "lucide-react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { Status } from "@/generated/prisma/enums"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { cn } from "@/lib/utils"


type TaskReadMarker = {
  agentId: string
  status: Status
  readAt: string | Date
  agent: {
    id: string
    AgentId: string
    name: string
  }
}

type TaskCard = {
  id: string
  name: string
  job: string
  status: Status
  note: string | null
  readMarkers: TaskReadMarker[]
  blockingReason: string | null
  assigned: {
    id: string
    name: string
    position: string
  }
}

type AgentOption = {
  id: string
  name: string
  position: string
}

type TaskKanbanProps = {
  agents: AgentOption[]
  projectId: string
  tasks: TaskCard[]
}

const columns = [
  { key: Status.todo, label: "Todo" },
  { key: Status.inprogress, label: "In progress" },
  { key: Status.blocked, label: "Blocked" },
  { key: Status.done, label: "Done" },
] as const

export function TaskKanban({ agents, projectId, tasks }: TaskKanbanProps) {
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null)
  const [editingTask, setEditingTask] = useState<TaskCard | null>(null)
  const [deletingTask, setDeletingTask] = useState<TaskCard | null>(null)
  const [confirmArchiveDone, setConfirmArchiveDone] = useState(false)
  const queryClient = useQueryClient()
  const projectQuery = useQuery({
    queryKey: ["project", projectId],
    queryFn: () =>
      apiJson<{ project: { tasks: TaskCard[] } }>(`/api/internal/projects/${projectId}`),
    initialData: { project: { tasks } },
  })
  const statusMutation = useMutation({
    mutationFn: ({ taskId, status }: { taskId: string; status: Status }) =>
      apiJson(`/api/internal/tasks/${taskId}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      }),
    onMutate: async ({ taskId, status }) => {
      await queryClient.cancelQueries({ queryKey: ["project", projectId] })
      const previous = queryClient.getQueryData<{ project: { tasks: TaskCard[] } }>([
        "project",
        projectId,
      ])

      queryClient.setQueryData<{ project: { tasks: TaskCard[] } }>(
        ["project", projectId],
        (current) =>
          current
            ? {
                project: {
                  ...current.project,
                  tasks: current.project.tasks.map((task) =>
                    task.id === taskId ? { ...task, status, readMarkers: [] } : task
                  ),
                },
              }
            : current
      )

      return { previous }
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["project", projectId], context.previous)
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["project", projectId] }),
  })
  const updateMutation = useMutation({
    mutationFn: ({
      taskId,
      payload,
    }: {
      taskId: string
      payload: {
        assignedAgentId: string
        name: string
        job: string
        status: string
        note: string
        readByAgentIds: string[]
        blockingReason: string
      }
    }) =>
      apiJson(`/api/internal/tasks/${taskId}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      setEditingTask(null)
      queryClient.invalidateQueries({ queryKey: ["project", projectId] })
    },
  })
  const archiveDoneMutation = useMutation({
    mutationFn: () =>
      apiJson<{ archivedCount: number }>(`/api/internal/projects/${projectId}/archive-done`, {
        method: "POST",
      }),
    onSuccess: () => {
      setConfirmArchiveDone(false)
      queryClient.invalidateQueries({ queryKey: ["project", projectId] })
    },
  })
  const deleteMutation = useMutation({
    mutationFn: (taskId: string) =>
      apiJson(`/api/internal/tasks/${taskId}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      setDeletingTask(null)
      queryClient.invalidateQueries({ queryKey: ["project", projectId] })
    },
  })
  const currentTasks = projectQuery.data.project.tasks
  const doneTaskCount = currentTasks.filter((task) => task.status === Status.done).length

  function moveTask(taskId: string, status: Status) {
    const task = currentTasks.find((item) => item.id === taskId)

    if (!task || task.status === status) {
      setDraggingTaskId(null)
      return
    }

    statusMutation.mutate({ taskId, status })
    setDraggingTaskId(null)
  }

  function updateTask(formData: FormData) {
    if (!editingTask) return

    const note = String(formData.get("note") ?? "")

    updateMutation.mutate({
      taskId: editingTask.id,
      payload: {
        assignedAgentId: String(formData.get("assignedAgentId") ?? ""),
        name: String(formData.get("name") ?? ""),
        job: String(formData.get("job") ?? ""),
        status: String(formData.get("status") ?? ""),
        note,
        readByAgentIds: formData.getAll("readByAgentIds").map(String),
        blockingReason: String(formData.get("blockingReason") ?? ""),
      },
    })
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card p-3">
        <div>
          <p className="text-sm font-medium">Completed tasks</p>
          <p className="text-sm text-muted-foreground">
            {doneTaskCount ? `${doneTaskCount} done task${doneTaskCount === 1 ? "" : "s"} can be archived.` : "No done tasks to archive."}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          disabled={!doneTaskCount || archiveDoneMutation.isPending}
          onClick={() => setConfirmArchiveDone(true)}
        >
          Archive done tasks
        </Button>
      </div>
      {statusMutation.error ? <p className="text-sm text-destructive">{statusMutation.error.message}</p> : null}
      {archiveDoneMutation.error ? <p className="text-sm text-destructive">{archiveDoneMutation.error.message}</p> : null}
      <div className="grid gap-4 xl:grid-cols-4">
        {columns.map((column) => {
          const columnTasks = currentTasks.filter((task) => task.status === column.key)

          return (
            <Card
              key={column.key}
              className="min-h-80"
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault()
                const taskId = event.dataTransfer.getData("text/plain") || draggingTaskId

                if (taskId) {
                  moveTask(taskId, column.key)
                }
              }}
              size="sm"
            >
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <CardTitle>{column.label}</CardTitle>
                  <Badge variant="outline">{columnTasks.length}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {columnTasks.length ? (
                  columnTasks.map((task) => (
                    <ContextMenu key={task.id}>
                      <ContextMenuTrigger asChild>
                        <Card
                          className="cursor-grab bg-background opacity-100 transition active:cursor-grabbing"
                          draggable
                          onDragEnd={() => setDraggingTaskId(null)}
                          onDragStart={(event) => {
                            setDraggingTaskId(task.id)
                            event.dataTransfer.setData("text/plain", task.id)
                            event.dataTransfer.effectAllowed = "move"
                          }}
                          size="sm"
                        >
                          <CardHeader>
                            <div className="flex items-start justify-between gap-2">
                              <CardTitle>{task.name}</CardTitle>
                              <ReadBadge task={task} agents={agents} />
                            </div>
                            <CardDescription>
                              <ExpandableText label="Job" text={task.job} />
                            </CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            <div className="rounded-2xl bg-muted p-3 text-sm">
                              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                                Assigned
                              </p>
                              <p className="mt-1 font-medium">{task.assigned.name}</p>
                              <p className="text-muted-foreground">{task.assigned.position}</p>
                            </div>
                            {task.note ? <ExpandableText label="Done summary" text={task.note} /> : null}
                            {task.blockingReason ? (
                              <ExpandableText
                                className="border border-destructive/30 bg-destructive/10 text-destructive"
                                label="Blocking reason"
                                text={task.blockingReason}
                              />
                            ) : null}
                          </CardContent>
                        </Card>
                      </ContextMenuTrigger>
                      <ContextMenuContent>
                        <ContextMenuItem onSelect={() => setEditingTask(task)}>
                          Update task
                        </ContextMenuItem>
                        <ContextMenuSeparator />
                        <ContextMenuItem
                          variant="destructive"
                          onSelect={() => setDeletingTask(task)}
                        >
                          Delete task
                        </ContextMenuItem>
                      </ContextMenuContent>
                    </ContextMenu>
                  ))
                ) : (
                  <p className="rounded-2xl bg-muted p-4 text-sm text-muted-foreground">
                    Drop tasks here.
                  </p>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>
      <Dialog open={!!editingTask} onOpenChange={(open) => !open && setEditingTask(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-2xl">Update task</DialogTitle>
            <DialogDescription>Edit task details and assignment.</DialogDescription>
          </DialogHeader>
          {editingTask ? (
            <form action={updateTask} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-task-name">Name</Label>
                <Input id="edit-task-name" name="name" defaultValue={editingTask.name} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-task-job">Job</Label>
                <Textarea id="edit-task-job" name="job" defaultValue={editingTask.job} rows={4} required />
              </div>
              <div className="space-y-2">
                <Label>Assigned agent</Label>
                <Select name="assignedAgentId" defaultValue={editingTask.assigned.id} required>
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
                <Select name="status" defaultValue={editingTask.status}>
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
                <Label htmlFor="edit-task-note">Done summary / note</Label>
                <Textarea
                  id="edit-task-note"
                  name="note"
                  defaultValue={editingTask.note ?? ""}
                  placeholder="Summarize what changed when this task is done"
                  rows={3}
                />
              </div>
              <ReadMarkerFields agents={agents} task={editingTask} />
              <div className="space-y-2">
                <Label htmlFor="edit-task-blocking-reason">Blocking reason</Label>
                <Textarea
                  id="edit-task-blocking-reason"
                  name="blockingReason"
                  defaultValue={editingTask.blockingReason ?? ""}
                  placeholder="Only needed if blocked"
                  rows={3}
                />
              </div>
              {updateMutation.error ? (
                <p className="text-sm text-destructive">{updateMutation.error.message}</p>
              ) : null}
              <DialogFooter>
                <Button disabled={updateMutation.isPending} type="submit">
                  {updateMutation.isPending ? "Saving..." : "Save changes"}
                </Button>
              </DialogFooter>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>
      <AlertDialog open={confirmArchiveDone} onOpenChange={setConfirmArchiveDone}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive done tasks?</AlertDialogTitle>
            <AlertDialogDescription>
              This hides {doneTaskCount} done task{doneTaskCount === 1 ? "" : "s"} from the active project board. Todo, in-progress, and blocked tasks stay visible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {archiveDoneMutation.error ? (
            <p className="text-sm text-destructive">{archiveDoneMutation.error.message}</p>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={archiveDoneMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={archiveDoneMutation.isPending || !doneTaskCount}
              onClick={(event) => {
                event.preventDefault()
                archiveDoneMutation.mutate()
              }}
            >
              {archiveDoneMutation.isPending ? "Archiving..." : "Archive done tasks"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={!!deletingTask} onOpenChange={(open) => !open && setDeletingTask(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete task?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes {deletingTask?.name ?? "this task"}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteMutation.error ? (
            <p className="text-sm text-destructive">{deleteMutation.error.message}</p>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteMutation.isPending}
              variant="destructive"
              onClick={(event) => {
                event.preventDefault()
                if (deletingTask) {
                  deleteMutation.mutate(deletingTask.id)
                }
              }}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}


function ExpandableText({
  className,
  label,
  text,
}: {
  className?: string
  label: string
  text: string
}) {
  const [expanded, setExpanded] = useState(false)
  const compact = text.length > 160 || text.includes("\n")

  return (
    <div className={cn("rounded-2xl bg-muted p-3 text-sm", className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
        {compact ? (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className="h-6 px-2"
            onClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
              setExpanded((value) => !value)
            }}
          >
            {expanded ? "Show less" : "Show more"}
            <ChevronDown
              className={cn("transition-transform", expanded ? "rotate-180" : "")}
            />
          </Button>
        ) : null}
      </div>
      <p
        className={cn("mt-1 whitespace-pre-wrap", compact && !expanded ? "max-h-16 overflow-hidden" : "")}
      >
        {text}
      </p>
    </div>
  )
}

function ReadBadge({ agents, task }: { agents: AgentOption[]; task: TaskCard }) {
  const currentStatusReads = task.readMarkers.filter((marker) => marker.status === task.status)

  if (!agents.length) return null

  return (
    <Badge variant={currentStatusReads.length ? "secondary" : "outline"}>
      {currentStatusReads.length}/{agents.length} read
    </Badge>
  )
}

function ReadMarkerFields({ agents, task }: { agents: AgentOption[]; task: TaskCard }) {
  const readAgentIds = new Set(
    task.readMarkers
      .filter((marker) => marker.status === task.status)
      .map((marker) => marker.agentId)
  )

  return (
    <div className="space-y-3 rounded-2xl border p-3 text-sm">
      <div>
        <Label>Read markers for current status</Label>
        <p className="text-muted-foreground">
          Applies only to this task while it is {task.status}. Changing the note without selecting readers marks this status unread.
        </p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {agents.map((agent) => (
          <label key={agent.id} className="flex items-center gap-2 rounded-xl bg-muted px-3 py-2">
            <input
              name="readByAgentIds"
              type="checkbox"
              value={agent.id}
              defaultChecked={readAgentIds.has(agent.id)}
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
  )
}
