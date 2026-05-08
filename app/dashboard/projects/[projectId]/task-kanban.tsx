"use client"

import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { Status } from "@/generated/prisma/enums"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { apiJson } from "@/lib/api/client"


type TaskCard = {
  id: string
  name: string
  job: string
  status: Status
  blockingReason: string | null
  assigned: {
    name: string
    position: string
  }
}

type TaskKanbanProps = {
  projectId: string
  tasks: TaskCard[]
}

const columns = [
  { key: Status.todo, label: "Todo" },
  { key: Status.inprogress, label: "In progress" },
  { key: Status.blocked, label: "Blocked" },
  { key: Status.done, label: "Done" },
] as const

export function TaskKanban({ projectId, tasks }: TaskKanbanProps) {
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null)
  const queryClient = useQueryClient()
  const projectQuery = useQuery({
    queryKey: ["project", projectId],
    queryFn: () =>
      apiJson<{ project: { tasks: TaskCard[] } }>(`/api/internal/projects/${projectId}`),
    initialData: { project: { tasks } },
  })
  const mutation = useMutation({
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
                    task.id === taskId ? { ...task, status } : task
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
  const currentTasks = projectQuery.data.project.tasks

  function moveTask(taskId: string, status: Status) {
    const task = currentTasks.find((item) => item.id === taskId)

    if (!task || task.status === status) {
      setDraggingTaskId(null)
      return
    }

    mutation.mutate({ taskId, status })
    setDraggingTaskId(null)
  }

  return (
    <div className="space-y-3">
      {mutation.error ? <p className="text-sm text-destructive">{mutation.error.message}</p> : null}
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
                    <Card
                      key={task.id}
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
                        <CardTitle>{task.name}</CardTitle>
                        <CardDescription>{task.job}</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="rounded-2xl bg-muted p-3 text-sm">
                          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                            Assigned
                          </p>
                          <p className="mt-1 font-medium">{task.assigned.name}</p>
                          <p className="text-muted-foreground">{task.assigned.position}</p>
                        </div>
                        {task.blockingReason ? (
                          <p className="rounded-2xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                            {task.blockingReason}
                          </p>
                        ) : null}
                      </CardContent>
                    </Card>
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
    </div>
  )
}
