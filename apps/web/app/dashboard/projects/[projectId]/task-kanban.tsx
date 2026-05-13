"use client"

import { useState } from "react"
import { Activity, ChevronDown } from "lucide-react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { Status } from "@/generated/prisma/enums"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
import { cn } from "@/lib/utils"

import {
  archiveDoneTasksAction,
  deleteTaskAction,
  getProjectDetailAction,
  getTaskDetailAction,
  updateTaskAction,
  updateTaskStatusAction,
} from "./actions"
import type { ProjectTask, ProjectTaskDetail, RequestDiagnostics } from "./types"

type TaskCard = ProjectTask
type TaskDetail = ProjectTaskDetail

type EditableTask =
  | TaskDetail
  | (TaskCard & { job?: string; note?: string | null })

type TaskDetailQueryData = {
  task: TaskDetail
  diagnostics?: RequestDiagnostics
}

type ProjectQueryData = {
  project: { tasks: TaskCard[] }
  diagnostics?: RequestDiagnostics
}

type AgentOption = {
  id: string
  AgentId: string
  name: string
  position: string
}

type TaskKanbanProps = {
  agents: AgentOption[]
  companyId: string
  projectId: string
  tasks: TaskCard[]
}

async function runProjectDetailAction(projectId: string): Promise<ProjectQueryData> {
  const result = await getProjectDetailAction(projectId)

  if (!result.ok) {
    throw new Error(result.error)
  }

  return { project: { tasks: result.project.tasks } }
}

async function runTaskDetailAction(taskId: string): Promise<TaskDetailQueryData> {
  const result = await getTaskDetailAction(taskId)

  if (!result.ok) {
    throw new Error(result.error)
  }

  return { task: result.task }
}

async function unwrapActionResult<T>(
  action: Promise<({ ok: true } & T) | { ok: false; error: string }>
): Promise<T> {
  const result = await action

  if (!result.ok) {
    throw new Error(result.error)
  }

  return result as T
}


const columns = [
  { key: Status.todo, label: "Todo" },
  { key: Status.inprogress, label: "In progress" },
  { key: Status.blocked, label: "Blocked" },
  { key: Status.done, label: "Done" },
] as const

export function TaskKanban({
  agents,
  companyId,
  projectId,
  tasks,
}: TaskKanbanProps) {
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null)
  const [editingTask, setEditingTask] = useState<EditableTask | null>(null)
  const [editingStatus, setEditingStatus] = useState<Status | null>(null)
  const [deletingTask, setDeletingTask] = useState<TaskCard | null>(null)
  const [confirmArchiveDone, setConfirmArchiveDone] = useState(false)
  const [archiveSuccess, setArchiveSuccess] = useState<string | null>(null)
  const queryClient = useQueryClient()
  const projectQuery = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => runProjectDetailAction(projectId),
    initialData: { project: { tasks } },
  })
  const statusMutation = useMutation({
    mutationFn: ({ taskId, status }: { taskId: string; status: Status }) =>
      unwrapActionResult(updateTaskStatusAction(taskId, status)),
    onMutate: async ({ taskId, status }) => {
      await queryClient.cancelQueries({ queryKey: ["project", projectId] })
      const previous = queryClient.getQueryData<ProjectQueryData>([
        "project",
        projectId,
      ])
      const now = new Date().toISOString()

      queryClient.setQueryData<ProjectQueryData>(
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
                          taskUpdatedAt: now,
                          taskUpdatedById: null,
                          taskUpdatedByName: "You",
                          taskUpdatedByType: "user",
                          readCount: 0,
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
      queryClient.invalidateQueries({
        queryKey: ["dashboard-summary", companyId],
      })
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
      }
    }) => unwrapActionResult(updateTaskAction(taskId, payload)),
    onSuccess: () => {
      setEditingTask(null)
      setEditingStatus(null)
      queryClient.invalidateQueries({ queryKey: ["project", projectId] })
    },
  })
  const archiveDoneMutation = useMutation({
    mutationFn: () => unwrapActionResult(archiveDoneTasksAction(projectId)),
    onSuccess: (data) => {
      setConfirmArchiveDone(false)
      setArchiveSuccess(
        data.archivedCount
          ? `Archived ${data.archivedCount} done task${data.archivedCount === 1 ? "" : "s"}.`
          : "No done tasks needed archiving."
      )
      queryClient.invalidateQueries({ queryKey: ["project", projectId] })
      queryClient.invalidateQueries({
        queryKey: ["dashboard-summary", companyId],
      })
      queryClient.invalidateQueries({ queryKey: ["projects", companyId] })
      queryClient.invalidateQueries({ queryKey: ["agents", companyId] })
    },
  })
  const deleteMutation = useMutation({
    mutationFn: (taskId: string) =>
      unwrapActionResult(deleteTaskAction(taskId)),
    onSuccess: () => {
      setDeletingTask(null)
      queryClient.invalidateQueries({ queryKey: ["project", projectId] })
      queryClient.invalidateQueries({
        queryKey: ["dashboard-summary", companyId],
      })
      queryClient.invalidateQueries({ queryKey: ["projects", companyId] })
      queryClient.invalidateQueries({ queryKey: ["agents", companyId] })
    },
  })
  const currentTasks = projectQuery.data.project.tasks
  const projectDiagnostics = projectQuery.data.diagnostics
  const doneTaskCount = currentTasks.filter(
    (task) => task.status === Status.done
  ).length
  const editingTaskQuery = useQuery({
    queryKey: ["task", editingTask?.id],
    queryFn: () => runTaskDetailAction(editingTask?.id ?? ""),
    enabled: Boolean(editingTask),
  })
  const editableTask = editingTaskQuery.data?.task ?? editingTask
  const editAgentOptions = editableTask
    ? agents.some((agent) => agent.id === editableTask.assigned.id)
      ? agents
      : [
          {
            id: editableTask.assigned.id,
            AgentId: "unlinked",
            name: editableTask.assigned.name,
            position: `${editableTask.assigned.position} · not linked`,
          },
          ...agents,
        ]
    : agents

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
            {doneTaskCount
              ? `${doneTaskCount} done task${doneTaskCount === 1 ? "" : "s"} can be archived.`
              : "No done tasks to archive."}
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
      {projectDiagnostics ? (
        <LatencyDiagnostics diagnostics={projectDiagnostics} />
      ) : null}
      {statusMutation.error ? (
        <p className="text-sm text-destructive">
          {statusMutation.error.message}
        </p>
      ) : null}
      {archiveDoneMutation.error ? (
        <p className="text-sm text-destructive">
          {archiveDoneMutation.error.message}
        </p>
      ) : null}
      <div className="grid gap-4 xl:grid-cols-4">
        {columns.map((column) => {
          const columnTasks = currentTasks.filter(
            (task) => task.status === column.key
          )

          return (
            <Card
              key={column.key}
              className="min-h-80"
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault()
                const taskId =
                  event.dataTransfer.getData("text/plain") || draggingTaskId

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
                          className="cursor-grab scroll-mt-24 bg-background opacity-100 transition target:ring-2 target:ring-primary/60 target:ring-offset-2 active:cursor-grabbing"
                          draggable
                          onDragEnd={() => setDraggingTaskId(null)}
                          onDragStart={(event) => {
                            setDraggingTaskId(task.id)
                            event.dataTransfer.setData("text/plain", task.id)
                            event.dataTransfer.effectAllowed = "move"
                          }}
                          size="sm"
                        >
                          <CardHeader className="space-y-3">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 space-y-1">
                                <CardTitle className="line-clamp-2 break-words">
                                  {task.name}
                                </CardTitle>
                                <TaskUpdateMeta task={task} />
                              </div>
                              <ReadBadge task={task} agents={agents} />
                            </div>
                            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                              <Badge variant="outline">
                                {task.assigned.name}
                              </Badge>
                              <span>{task.assigned.position}</span>
                              {task.summaryUpdatedAt ? (
                                <span>
                                  Summary updated{" "}
                                  {formatRelativeTime(
                                    new Date(task.summaryUpdatedAt)
                                  )}
                                </span>
                              ) : null}
                            </div>
                            {task.blockingReasonPreview ? (
                              <p className="line-clamp-2 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                                Blocked: {task.blockingReasonPreview}
                              </p>
                            ) : null}
                            {task.notePreview ? (
                              <TaskCardPreview
                                label="Done summary"
                                text={task.notePreview}
                                tone={task.isUnreadDoneSummary ? "unread" : "default"}
                              />
                            ) : task.summaryUpdatedAt ? (
                              <p className="rounded-xl bg-muted px-3 py-2 text-sm text-muted-foreground">
                                Done summary available · updated{" "}
                                {formatRelativeTime(
                                  new Date(task.summaryUpdatedAt)
                                )}
                              </p>
                            ) : null}
                          </CardHeader>
                          <CardContent>
                            <TaskDetails task={task} />
                          </CardContent>
                        </Card>
                      </ContextMenuTrigger>
                      <ContextMenuContent>
                        <ContextMenuItem
                          onSelect={() => {
                            setEditingTask(
                              queryClient.getQueryData<TaskDetailQueryData>([
                                "task",
                                task.id,
                              ])?.task ?? task
                            )
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
            <DialogDescription>
              Edit task details and assignment.
            </DialogDescription>
          </DialogHeader>
          {editableTask ? (
            editingTaskQuery.isLoading && !("job" in editableTask) ? (
              <TaskEditSkeleton />
            ) : editingTaskQuery.isError ? (
              <div className="space-y-3 rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
                <p>{editingTaskQuery.error.message}</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => editingTaskQuery.refetch()}
                >
                  Retry loading task
                </Button>
              </div>
            ) : (
              <form action={updateTask} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-task-name">Name</Label>
                  <Input
                    id="edit-task-name"
                    name="name"
                    defaultValue={editableTask.name}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-task-job">Job</Label>
                  <Textarea
                    id="edit-task-job"
                    name="job"
                    defaultValue={"job" in editableTask ? editableTask.job : ""}
                    rows={4}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Assigned agent</Label>
                  <p className="text-xs text-muted-foreground">
                    Showing agents linked to this project.
                  </p>
                  {!agents.some(
                    (agent) => agent.id === editableTask.assigned.id
                  ) ? (
                    <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
                      Current assignee is not linked to this project. You can
                      save unchanged or pick a linked agent.
                    </p>
                  ) : null}
                  <Select
                    name="assignedAgentId"
                    defaultValue={editableTask.assigned.id}
                    required
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select agent" />
                    </SelectTrigger>
                    <SelectContent>
                      {editAgentOptions.map((agent) => (
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
                    value={editingStatus ?? editableTask.status}
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
                <div className="space-y-2">
                  <Label htmlFor="edit-task-note">Done summary / note</Label>
                  <Textarea
                    id="edit-task-note"
                    name="note"
                    defaultValue={
                      "note" in editableTask ? (editableTask.note ?? "") : ""
                    }
                    placeholder="Summarize what changed when this task is done"
                    rows={3}
                  />
                </div>
                {editingStatus === editableTask.status ? (
                  <ReadMarkerFields agents={agents} task={editableTask} />
                ) : (
                  <div className="space-y-1 rounded-2xl border p-3 text-sm text-muted-foreground">
                    <Label>Read markers for current status</Label>
                    <p>
                      Status changes start unread for the destination status and
                      keep other status read markers intact. Save first, then
                      reopen this task to edit read markers for the new status.
                    </p>
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="edit-task-blocking-reason">
                    Blocking reason
                  </Label>
                  <Textarea
                    id="edit-task-blocking-reason"
                    name="blockingReason"
                    defaultValue={editableTask.blockingReason ?? ""}
                    placeholder="Only needed if blocked"
                    rows={3}
                  />
                </div>
                {updateMutation.error ? (
                  <p className="text-sm text-destructive">
                    {updateMutation.error.message}
                  </p>
                ) : null}
                <DialogFooter>
                  <Button
                    disabled={
                      updateMutation.isPending || editingTaskQuery.isFetching
                    }
                    type="submit"
                  >
                    {updateMutation.isPending ? "Saving..." : "Save changes"}
                  </Button>
                </DialogFooter>
              </form>
            )
          ) : null}
        </DialogContent>
      </Dialog>
      <AlertDialog
        open={confirmArchiveDone}
        onOpenChange={setConfirmArchiveDone}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive done tasks?</AlertDialogTitle>
            <AlertDialogDescription>
              This hides {doneTaskCount} done task
              {doneTaskCount === 1 ? "" : "s"} from the active project board.
              Todo, in-progress, and blocked tasks stay visible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {archiveDoneMutation.error ? (
            <p className="text-sm text-destructive">
              {archiveDoneMutation.error.message}
            </p>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={archiveDoneMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={archiveDoneMutation.isPending || !doneTaskCount}
              onClick={(event) => {
                event.preventDefault()
                archiveDoneMutation.mutate()
              }}
            >
              {archiveDoneMutation.isPending
                ? "Archiving..."
                : "Archive done tasks"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog
        open={!!deletingTask}
        onOpenChange={(open) => !open && setDeletingTask(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete task?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes {deletingTask?.name ?? "this task"}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteMutation.error ? (
            <p className="text-sm text-destructive">
              {deleteMutation.error.message}
            </p>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>
              Cancel
            </AlertDialogCancel>
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
                <div
                  key={index}
                  className="space-y-3 rounded-2xl border bg-background p-4"
                >
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

function LatencyDiagnostics({
  compact = false,
  diagnostics,
}: {
  compact?: boolean
  diagnostics: RequestDiagnostics
}) {
  return (
    <div
      className={cn(
        "flex gap-2 rounded-2xl border border-dashed bg-muted/40 p-3 text-xs text-muted-foreground",
        compact ? "items-start" : "items-center"
      )}
    >
      <Activity className="mt-0.5 size-4 shrink-0" />
      <p>
        {diagnostics.label} fetch: {diagnostics.clientDurationMs}ms client
        {diagnostics.serverTiming ? (
          <>
            {" "}· Server-Timing: {" "}
            <code className="rounded bg-background px-1 py-0.5 break-all">
              {diagnostics.serverTiming}
            </code>
          </>
        ) : null}
      </p>
    </div>
  )
}

function TaskCardPreview({
  label,
  text,
  tone = "default",
}: {
  label: string
  text: string
  tone?: "default" | "unread"
}) {
  const [expanded, setExpanded] = useState(false)
  const compact = text.length > 120

  return (
    <div
      className={cn(
        "rounded-xl px-3 py-2 text-sm",
        tone === "unread"
          ? "border border-primary/30 bg-primary/10 text-primary"
          : "bg-muted text-muted-foreground"
      )}
    >
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 text-left"
        aria-expanded={expanded}
        onClick={(event) => {
          event.preventDefault()
          event.stopPropagation()
          setExpanded((value) => !value)
        }}
      >
        <span className="text-xs tracking-[0.16em] uppercase">{label}</span>
        <span className="flex shrink-0 items-center gap-1 text-xs">
          {compact ? (expanded ? "Less" : "More") : "View"}
          <ChevronDown
            className={cn("size-4 transition-transform", expanded ? "rotate-180" : "")}
          />
        </span>
      </button>
      <p
        className={cn(
          "mt-2 whitespace-pre-wrap break-words",
          !expanded ? "line-clamp-2" : ""
        )}
      >
        {text}
      </p>
    </div>
  )
}

function TaskDetails({ task }: { task: TaskCard }) {
  const [expanded, setExpanded] = useState(false)
  const detailQuery = useQuery({
    queryKey: ["task", task.id],
    queryFn: () => runTaskDetailAction(task.id),
    enabled: expanded,
  })
  const detail = detailQuery.data?.task

  return (
    <div className="space-y-3">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-8 px-2 text-muted-foreground"
        aria-expanded={expanded}
        onClick={(event) => {
          event.preventDefault()
          event.stopPropagation()
          setExpanded((value) => !value)
        }}
      >
        {expanded ? "Hide details" : "Show details"}
        <ChevronDown
          className={cn("transition-transform", expanded ? "rotate-180" : "")}
        />
      </Button>
      {expanded ? (
        <div className="space-y-3">
          {detailQuery.isLoading ? (
            <TaskDetailSkeleton />
          ) : detailQuery.isError ? (
            <div className="space-y-2 rounded-2xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              <p>{detailQuery.error.message}</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => detailQuery.refetch()}
              >
                Retry
              </Button>
            </div>
          ) : detail ? (
            <>
              {detailQuery.data?.diagnostics ? (
                <LatencyDiagnostics diagnostics={detailQuery.data.diagnostics} compact />
              ) : null}
              <ExpandableText label="Job" text={detail.job} />
              {detail.note ? (
                <ExpandableText label="Done summary" text={detail.note} />
              ) : null}
              {detail.blockingReason ? (
                <ExpandableText
                  className="border border-destructive/30 bg-destructive/10 text-destructive"
                  label="Blocking reason"
                  text={detail.blockingReason}
                />
              ) : null}
              <ReadMarkerDetails task={detail} />
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function TaskDetailSkeleton() {
  return (
    <div className="space-y-3" aria-label="Loading task details">
      <div className="h-16 animate-pulse rounded-2xl bg-muted" />
      <div className="h-12 animate-pulse rounded-2xl bg-muted" />
    </div>
  )
}

function TaskEditSkeleton() {
  return (
    <div className="space-y-4" aria-label="Loading task editor">
      <div className="h-10 animate-pulse rounded bg-muted" />
      <div className="h-24 animate-pulse rounded bg-muted" />
      <div className="h-10 animate-pulse rounded bg-muted" />
      <div className="h-20 animate-pulse rounded bg-muted" />
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
        <p className="text-xs tracking-[0.16em] text-muted-foreground uppercase">
          {label}
        </p>
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
              className={cn(
                "transition-transform",
                expanded ? "rotate-180" : ""
              )}
            />
          </Button>
        ) : null}
      </div>
      <p
        className={cn(
          "mt-1 whitespace-pre-wrap",
          compact && !expanded ? "max-h-16 overflow-hidden" : ""
        )}
      >
        {text}
      </p>
    </div>
  )
}

function ReadMarkerDetails({ task }: { task: TaskCard }) {
  const currentStatusReads = (task.readMarkers ?? []).filter(
    (marker) => marker.status === task.status
  )

  return (
    <div className="rounded-2xl bg-muted p-3 text-sm">
      <p className="text-xs tracking-[0.16em] text-muted-foreground uppercase">
        Read markers
      </p>
      {currentStatusReads.length ? (
        <ul className="mt-2 space-y-1 text-muted-foreground">
          {currentStatusReads.map((marker) => (
            <li key={`${marker.agentId}-${marker.status}`}>
              {marker.agent.name} read {marker.status}{" "}
              {formatRelativeTime(new Date(marker.readAt))}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-muted-foreground">
          No agents have read this {task.status} card yet.
        </p>
      )}
    </div>
  )
}

function TaskUpdateMeta({ task }: { task: TaskCard }) {
  const updatedAt = new Date(task.taskUpdatedAt)

  if (Number.isNaN(updatedAt.getTime())) return null

  const actor =
    task.taskUpdatedByName?.trim() ||
    fallbackUpdaterLabel(task.taskUpdatedByType)
  const exact = new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(updatedAt)

  return (
    <p
      className="text-xs text-muted-foreground"
      title={`Updated ${exact}${actor ? ` by ${actor}` : ""}`}
    >
      Updated {formatRelativeTime(updatedAt)}
      {actor ? ` by ${actor}` : ""}
    </p>
  )
}

function fallbackUpdaterLabel(type: string) {
  if (type === "agent") return "agent"
  if (type === "user") return "user"

  return "system"
}

function formatRelativeTime(date: Date) {
  const diffSeconds = Math.round((date.getTime() - Date.now()) / 1000)
  const absSeconds = Math.abs(diffSeconds)
  const units = [
    { unit: "year", seconds: 31536000 },
    { unit: "month", seconds: 2592000 },
    { unit: "week", seconds: 604800 },
    { unit: "day", seconds: 86400 },
    { unit: "hour", seconds: 3600 },
    { unit: "minute", seconds: 60 },
  ] as const
  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" })

  for (const { unit, seconds } of units) {
    if (absSeconds >= seconds) {
      return formatter.format(Math.round(diffSeconds / seconds), unit)
    }
  }

  return formatter.format(diffSeconds, "second")
}

function ReadBadge({
  agents,
  task,
}: {
  agents: AgentOption[]
  task: TaskCard
}) {
  if (!agents.length) return null

  return (
    <Badge variant={task.readCount ? "secondary" : "outline"}>
      {task.readCount}/{agents.length} read
    </Badge>
  )
}

function ReadMarkerFields({
  agents,
  task,
}: {
  agents: AgentOption[]
  task: TaskCard
}) {
  const readAgentIds = new Set(
    (task.readMarkers ?? [])
      .filter((marker) => marker.status === task.status)
      .map((marker) => marker.agentId)
  )

  return (
    <div className="space-y-3 rounded-2xl border p-3 text-sm">
      <div>
        <Label>Read markers for current status</Label>
        <p className="text-muted-foreground">
          Applies only to this task while it is {task.status}. Changing the note
          without selecting readers marks this status unread.
        </p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {agents.map((agent) => (
          <label
            key={agent.id}
            className="flex items-center gap-2 rounded-xl bg-muted px-3 py-2"
          >
            <input
              name="readByAgentIds"
              type="checkbox"
              value={agent.id}
              defaultChecked={readAgentIds.has(agent.id)}
              className="size-4 accent-primary"
            />
            <span>
              <span className="font-medium">{agent.name}</span>
              <span className="block text-xs text-muted-foreground">
                {agent.position}
              </span>
            </span>
          </label>
        ))}
      </div>
    </div>
  )
}
