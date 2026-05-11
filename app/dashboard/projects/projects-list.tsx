"use client"

import Link from "next/link"
import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { MoreHorizontalIcon } from "lucide-react"

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
import { Button } from "@/components/ui/button"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { apiJson } from "@/lib/api/client"

type ProjectRow = {
  id: string
  name: string
  description: string
}

type ProjectsListProps = {
  companyId: string
}

export function ProjectsList({ companyId }: ProjectsListProps) {
  const projectsQuery = useQuery({
    queryKey: ["projects", companyId],
    queryFn: () =>
      apiJson<{ projects: ProjectRow[] }>(`/api/internal/projects?companyId=${companyId}`),
  })
  const projects = projectsQuery.data?.projects ?? []

  if (projectsQuery.isLoading) {
    return <ProjectsListSkeleton />
  }

  if (projectsQuery.isError) {
    return (
      <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
        <p>{projectsQuery.error.message}</p>
        <Button className="mt-3" size="sm" variant="outline" onClick={() => projectsQuery.refetch()}>
          Retry
        </Button>
      </div>
    )
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {projects.length ? (
        projects.map((project) => (
          <Card key={project.id} className="h-full transition hover:bg-muted/40 hover:ring-foreground/20" size="sm">
            <div className="flex items-start gap-2">
              <Link className="min-w-0 flex-1" href={`/dashboard/projects/${project.id}`}>
                <CardHeader>
                  <CardTitle>{project.name}</CardTitle>
                  <CardDescription>{project.description || "No description"}</CardDescription>
                </CardHeader>
              </Link>
              <ProjectActions companyId={companyId} project={project} />
            </div>
          </Card>
        ))
      ) : (
        <p className="rounded-2xl bg-muted p-6 text-sm text-muted-foreground md:col-span-2 xl:col-span-3">
          No projects yet.
        </p>
      )}
    </div>
  )
}

function ProjectsListSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-label="Loading projects">
      {Array.from({ length: 6 }, (_, index) => (
        <Card key={index} className="h-32 animate-pulse bg-muted" size="sm" />
      ))}
    </div>
  )
}

type ProjectActionsProps = {
  companyId: string
  project: ProjectRow
}

function ProjectActions({ companyId, project }: ProjectActionsProps) {
  const [renameOpen, setRenameOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const queryClient = useQueryClient()

  const renameMutation = useMutation({
    mutationFn: (payload: { name: string }) =>
      apiJson<{ project: ProjectRow }>(`/api/internal/projects/${project.id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      setRenameOpen(false)
      queryClient.invalidateQueries({ queryKey: ["projects", companyId] })
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary", companyId] })
      queryClient.invalidateQueries({ queryKey: ["project", project.id] })
    },
  })
  const deleteMutation = useMutation({
    mutationFn: () =>
      apiJson(`/api/internal/projects/${project.id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      setDeleteOpen(false)
      queryClient.invalidateQueries({ queryKey: ["projects", companyId] })
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary", companyId] })
      queryClient.removeQueries({ queryKey: ["project", project.id] })
    },
  })

  function renameAction(formData: FormData) {
    renameMutation.mutate({ name: String(formData.get("name") ?? "") })
  }

  return (
    <div className="p-3 pl-0">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="icon-sm" variant="ghost" type="button">
            <MoreHorizontalIcon />
            <span className="sr-only">Open project actions</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>{project.name}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setRenameOpen(true)}>
            Rename project
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onSelect={() => setDeleteOpen(true)}>
            Delete project
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Rename project</DialogTitle>
            <DialogDescription>Update the project name shown across the dashboard.</DialogDescription>
          </DialogHeader>
          <form action={renameAction} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor={`project-name-${project.id}`}>Name</Label>
              <Input id={`project-name-${project.id}`} name="name" defaultValue={project.name} required />
            </div>
            {renameMutation.error ? (
              <p className="text-sm text-destructive">{renameMutation.error.message}</p>
            ) : null}
            <Button disabled={renameMutation.isPending} type="submit">
              {renameMutation.isPending ? "Saving..." : "Save name"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {project.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the project and all of its tasks. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteMutation.error ? (
            <p className="text-sm text-destructive">{deleteMutation.error.message}</p>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <form action={() => deleteMutation.mutate()}>
              <AlertDialogAction disabled={deleteMutation.isPending} variant="destructive" type="submit">
                {deleteMutation.isPending ? "Deleting..." : "Delete"}
              </AlertDialogAction>
            </form>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
