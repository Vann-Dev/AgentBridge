"use client"

import { useState } from "react"
import Link from "next/link"
import { ChevronDown } from "lucide-react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { apiJson } from "@/lib/api/client"
import { cn } from "@/lib/utils"

type NoteTask = {
  id: string
  name: string
  status: string
  note: string
  summaryUpdatedAt: string | null
  assigned: {
    id: string
    name: string
    position: string
  }
  project: {
    id: string
    name: string
  }
}

type ReviewReader = {
  id: string
  AgentId: string
  name: string
}

type NoteListProps = {
  companyId: string
  reviewReader: ReviewReader | null
  initialNotes: NoteTask[]
}

export function NoteList({ companyId, reviewReader, initialNotes }: NoteListProps) {
  const queryClient = useQueryClient()
  const notesQuery = useQuery({
    queryKey: ["notes", companyId],
    queryFn: () =>
      apiJson<{ notes: NoteTask[]; reviewReader: ReviewReader | null }>(
        `/api/internal/notes?company=${companyId}`
      ),
    initialData: { notes: initialNotes, reviewReader },
  })
  const markReadMutation = useMutation({
    mutationFn: (taskId: string) =>
      apiJson(`/api/internal/notes/${taskId}/read`, {
        method: "POST",
      }),
    onSuccess: (_data, taskId) => {
      queryClient.setQueryData<{ notes: NoteTask[] }>(["notes", companyId], (current) =>
        current
          ? { notes: current.notes.filter((task) => task.id !== taskId) }
          : current
      )
      queryClient.invalidateQueries({ queryKey: ["project"] })
    },
  })
  const notes = notesQuery.data.notes
  const currentReviewReader = notesQuery.data.reviewReader ?? reviewReader
  const reviewReaderLabel = currentReviewReader
    ? currentReviewReader.AgentId === "main"
      ? "Natsuki/main"
      : `${currentReviewReader.name} (${currentReviewReader.AgentId})`
    : "No review reader"

  return (
    <div className="space-y-4">
      {notesQuery.isFetching ? (
        <p className="text-sm text-muted-foreground">Refreshing notes...</p>
      ) : null}
      {notesQuery.error ? (
        <div className="space-y-3 rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          <p>{notesQuery.error.message}</p>
          <Button type="button" variant="outline" size="sm" onClick={() => notesQuery.refetch()}>
            Retry
          </Button>
        </div>
      ) : null}
      {!currentReviewReader ? (
        <div className="rounded-2xl border border-dashed p-8 text-center">
          <p className="font-medium">No review reader available</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Add an agent to this company before marking done summaries reviewed.
          </p>
        </div>
      ) : notes.length ? (
        <div className="grid gap-4">
          {notes.map((task) => (
            <Card key={task.id} size="sm">
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <CardTitle className="break-words">{task.name}</CardTitle>
                    <CardDescription>
                      {task.project.name} · {task.assigned.name} ({task.assigned.position})
                    </CardDescription>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{formatStatus(task.status)}</Badge>
                    {task.summaryUpdatedAt ? (
                      <Badge variant="secondary">{formatDate(task.summaryUpdatedAt)}</Badge>
                    ) : null}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <ExpandableNote text={task.note} />
                <div className="flex flex-wrap gap-2">
                  <Button asChild type="button" variant="outline" size="sm">
                    <Link href={`/dashboard/projects/${task.project.id}?company=${companyId}#task-${task.id}`}>
                      Open source task
                    </Link>
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    disabled={markReadMutation.isPending}
                    onClick={() => markReadMutation.mutate(task.id)}
                  >
                    {markReadMutation.isPending ? (
                      "Marking..."
                    ) : (
                      `Mark reviewed by ${reviewReaderLabel}`
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed p-8 text-center">
          <p className="font-medium">No unread done summaries</p>
          <p className="mt-2 text-sm text-muted-foreground">
            New done task summaries appear here until {reviewReaderLabel} marks them reviewed.
          </p>
        </div>
      )}
      {markReadMutation.error ? (
        <p className="text-sm text-destructive">{markReadMutation.error.message}</p>
      ) : null}
    </div>
  )
}

function ExpandableNote({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false)
  const compact = text.length > 320 || text.includes("\n")

  return (
    <div className="rounded-2xl bg-muted p-3 text-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
          Agent result note
        </p>
        {compact ? (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className="h-6 px-2"
            onClick={() => setExpanded((value) => !value)}
          >
            {expanded ? "Show less" : "Show more"}
            <ChevronDown className={cn("transition-transform", expanded ? "rotate-180" : "")} />
          </Button>
        ) : null}
      </div>
      <p className={cn("mt-2 whitespace-pre-wrap", compact && !expanded ? "max-h-24 overflow-hidden" : "")}>
        {text}
      </p>
    </div>
  )
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value))
}

function formatStatus(status: string) {
  if (status === "inprogress") return "In progress"

  return status.charAt(0).toUpperCase() + status.slice(1)
}
