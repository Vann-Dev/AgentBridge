"use client"

import { useState } from "react"
import Link from "next/link"
import { ChevronDown } from "lucide-react"
import { useQuery } from "@tanstack/react-query"

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

type NoteListProps = {
  companyId: string
  initialNotes: NoteTask[]
}

export function NoteList({ companyId, initialNotes }: NoteListProps) {
  const notesQuery = useQuery({
    queryKey: ["notes", companyId],
    queryFn: () => apiJson<{ notes: NoteTask[] }>(`/api/internal/notes?company=${companyId}`),
    initialData: { notes: initialNotes },
  })
  const notes = notesQuery.data.notes

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
      {notes.length ? (
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
                <Button asChild type="button" variant="outline" size="sm">
                  <Link href={`/dashboard/projects/${task.project.id}?company=${companyId}#task-${task.id}`}>
                    Open source task
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed p-8 text-center">
          <p className="font-medium">No result notes yet</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Agent handoffs and done summaries written in task notes will appear here.
          </p>
        </div>
      )}
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
