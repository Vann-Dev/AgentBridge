"use client"

import { useOptimistic, useState, useTransition } from "react"

import { Status } from "@/generated/prisma/enums"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

import { updateTaskStatus } from "./actions"

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
  tasks: TaskCard[]
}

const columns = [
  { key: Status.todo, label: "Todo" },
  { key: Status.inprogress, label: "In progress" },
  { key: Status.blocked, label: "Blocked" },
  { key: Status.done, label: "Done" },
] as const

export function TaskKanban({ tasks }: TaskKanbanProps) {
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [, startTransition] = useTransition()
  const [optimisticTasks, moveOptimisticTask] = useOptimistic(
    tasks,
    (currentTasks, move: { taskId: string; status: Status }) =>
      currentTasks.map((task) =>
        task.id === move.taskId ? { ...task, status: move.status } : task
      )
  )

  function moveTask(taskId: string, status: Status) {
    const task = optimisticTasks.find((item) => item.id === taskId)

    if (!task || task.status === status) {
      setDraggingTaskId(null)
      return
    }

    setError(null)
    startTransition(async () => {
      moveOptimisticTask({ taskId, status })
      const result = await updateTaskStatus(taskId, status)

      if (result.error) {
        setError(result.error)
      }
    })
    setDraggingTaskId(null)
  }

  return (
    <div className="space-y-3">
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <div className="grid gap-4 xl:grid-cols-4">
        {columns.map((column) => {
          const columnTasks = optimisticTasks.filter((task) => task.status === column.key)

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
