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
  summaryUpdatedAt: string | Date | null
  readMarkers: TaskReadMarker[]
  blockingReason: string | null
  dependencies: TaskDependency[]
  dependencyIds: string[]
  unblocks: TaskDependency[]
  isDependencyReady: boolean
  assigned: {
    id: string
    name: string
    position: string
  }
}

type TaskDependency = {
  id: string
  name: string
  status: Status
}

type AgentOption = {
  id: string
  name: string
  position: string
}

type TaskKanbanProps = {
  agents: AgentOption[]
  companyId: string
  projectId: string
  tasks: TaskCard[]
}

const columns = [
  { key: Status.todo, label: "Todo" },
  { key: Status.inprogress, label: "In progress" },
  { key: Status.blocked, label: "Blocked" },
  { key: Status.done, label: "Done" },
] as const

export function TaskKanban({ agents, companyId, projectId, tasks }: TaskKanbanProps) {
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null)
  const [editingTask, setEditingTask] = useState<TaskCard | null>(null)
  const [editingStatus, setEditingStatus] = useState<Status | null>(null)
  const [deletingTask, setDeletingTask] = useState<TaskCard | null>(null)
  const [confirmArchiveDone, setConfirmArchiveDone] = useState(false)
  const [archiveSuccess, setArchiveSuccess] = useState<string | null>(null)
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
                    task.id === taskId
                      ? {
                          ...task,
                          status,
                          readMarkers: task.readMarkers.filter((marker) => marker.status !== status),
                        }
                      : task
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
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["project", projectId] })
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary", companyId] })
      queryClient.invalidateQueries({ queryKey: ["projects", companyId] })
      queryClient.invalidateQueries({ queryKey: ["agents", companyId] })
    },
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
        dependencyIds: string[]
      }
    }) =>
      apiJson(`/api/internal/tasks/${taskId}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      setEditingTask(null)
      setEditingStatus(null)
      queryClient.invalidateQueries({ queryKey: ["project", projectId] })
    },
  })
  const archiveDoneMutation = useMutation({
    mutationFn: () =>
      apiJson<{ archivedCount: number }>(`/api/internal/projects/${projectId}/archive-done`, {
        method: "POST",
      }),
    onSuccess: (data) => {
      setConfirmArchiveDone(false)
      setArchiveSuccess(
        data.archivedCount
          ? `Archived ${data.archivedCount} done task${data.archivedCount === 1 ? "" : "s"}.`
          : "No done tasks needed archiving."
      )
      queryClient.invalidateQueries({ queryKey: ["project", projectId] })
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary", companyId] })
      queryClient.invalidateQueries({ queryKey: ["projects", companyId] })
      queryClient.invalidateQueries({ queryKey: ["agents", companyId] })
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
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary", companyId] })
      queryClient.invalidateQueries({ queryKey: ["projects", companyId] })
      queryClient.invalidateQueries({ queryKey: ["agents", companyId] })
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
        dependencyIds: formData.getAll("dependencyIds").map(String),
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
      {archiveSuccess ? (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-300">
          <span>{archiveSuccess}</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-emerald-700 hover:text-emerald-800 dark:text-emerald-300 dark:hover:text-emerald-200"
            onClick={() => setArchiveSuccess(null)}
          >
            Dismiss
          </Button>
        </div>
      ) : null}
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
                          id={`task-${task.id}`}
                          className="cursor-grab scroll-mt-6 bg-background opacity-100 transition active:cursor-grabbing"
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
                            {task.dependencies.length ? (
                              <DependencySummary task={task} />
                            ) : null}
                            {task.unblocks.length ? (
                              <p className="text-xs text-muted-foreground">
                                Unblocks {task.unblocks.length} task{task.unblocks.length === 1 ? "" : "s"}.
                              </p>
                            ) : null}
                            {task.note ? <ExpandableText label="Agent result note" text={task.note} /> : null}
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
                        <ContextMenuItem
                          onSelect={() => {
                            setEditingTask(task)
                            setEditingStatus(task.status)
                          }}
                        >
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
      <Dialog
        open={!!editingTask}
        onOpenChange={(open) => {
          if (!open) {
            setEditingTask(null)
            setEditingStatus(null)
          }
        }}
      >
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
                <Select
                  name="status"
                  value={editingStatus ?? editingTask.status}
                  onValueChange={(value) => setEditingStatus(value as Status)}
                >
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
              <DependencyFields currentTaskId={editingTask.id} tasks={currentTasks} defaultDependencyIds={editingTask.dependencyIds} />
              <div className="space-y-2">
                <Label htmlFor="edit-task-note">Agent result note / done summary</Label>
                <Textarea
                  id="edit-task-note"
                  name="note"
                  defaultValue={editingTask.note ?? ""}
                  placeholder="Share the result, handoff, changed files, branch/PR, and checks when done."
                  rows={4}
                />
                <p className="text-xs text-muted-foreground">
                  Notes appear on task cards and the Notes page. Updating this field keeps read markers per status and marks the current status unread unless readers are selected.
                </p>
              </div>
              {editingStatus === editingTask.status ? (
                <ReadMarkerFields agents={agents} task={editingTask} />
              ) : (
                <div className="space-y-1 rounded-2xl border p-3 text-sm text-muted-foreground">
                  <Label>Read markers for current status</Label>
                  <p>
                    Status changes start unread for the destination status and keep other status read
                    markers intact. Save first, then reopen this task to edit read markers for the new
                    status.
                  </p>
                </div>
              )}
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



export function TaskKanbanSkeleton() {
  return (
    <div className="space-y-3" aria-label="Loading project tasks">
      <div className="grid gap-4 xl:grid-cols-4">
        {columns.map((column) => (
          <Card key={column.key} className="min-h-80" size="sm">
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <CardTitle>{column.label}</CardTitle>
                <Badge variant="outline">—</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {Array.from({ length: 3 }, (_, index) => (
                <div key={index} className="space-y-3 rounded-2xl border bg-background p-4">
                  <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
                  <div className="h-14 animate-pulse rounded-2xl bg-muted" />
                  <div className="h-16 animate-pulse rounded-2xl bg-muted" />
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
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

function DependencyFields({
  currentTaskId,
  defaultDependencyIds,
  tasks,
}: {
  currentTaskId?: string
  defaultDependencyIds: string[]
  tasks: TaskCard[]
}) {
  const options = tasks.filter((task) => task.id !== currentTaskId)

  return (
    <div className="space-y-3 rounded-2xl border p-3 text-sm">
      <div>
        <Label>Dependencies</Label>
        <p className="text-muted-foreground">Select tasks that must be done before this task is ready.</p>
      </div>
      {options.length ? (
        <div className="grid max-h-44 gap-2 overflow-auto pr-1 sm:grid-cols-2">
          {options.map((task) => (
            <label key={task.id} className="flex items-start gap-2 rounded-xl bg-muted px-3 py-2">
              <input
                name="dependencyIds"
                type="checkbox"
                value={task.id}
                defaultChecked={defaultDependencyIds.includes(task.id)}
                className="mt-1 size-4 accent-primary"
              />
              <span className="min-w-0">
                <span className="block truncate font-medium">{task.name}</span>
                <span className="block text-xs text-muted-foreground">{statusLabels.get(task.status)}</span>
              </span>
            </label>
          ))}
        </div>
      ) : (
        <p className="rounded-xl bg-muted px-3 py-2 text-muted-foreground">No other tasks are available.</p>
      )}
    </div>
  )
}

function DependencySummary({ task }: { task: TaskCard }) {
  const doneCount = task.dependencies.filter((dependency) => dependency.status === Status.done).length

  return (
    <div className="rounded-2xl border bg-muted p-3 text-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Dependencies</p>
        <Badge variant={task.isDependencyReady ? "secondary" : "outline"}>
          {doneCount}/{task.dependencies.length} done
        </Badge>
      </div>
      <div className="mt-2 space-y-1">
        {task.dependencies.slice(0, 3).map((dependency) => (
          <p key={dependency.id} className="truncate text-muted-foreground">
            {dependency.status === Status.done ? "✓" : "•"} {dependency.name}
          </p>
        ))}
        {task.dependencies.length > 3 ? (
          <p className="text-xs text-muted-foreground">+{task.dependencies.length - 3} more</p>
        ) : null}
      </div>
    </div>
  )
}

const statusLabels = new Map(columns.map((column) => [column.key, column.label]))

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
          Applies only to this task while it is {task.status}. Changing the result note without selecting readers marks this status unread.
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
