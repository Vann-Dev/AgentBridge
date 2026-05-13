"use client"

import Link from "next/link"
import { useState, useTransition } from "react"
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

import { CreateProjectDialog } from "./create-project-dialog"
import { deleteProjectAction, renameProjectAction } from "./actions"

type ProjectRow = {
  id: string
  name: string
  description: string
}

type ProjectsListProps = {
  companyId: string
  initialProjects: ProjectRow[]
}

export function ProjectsList({ companyId, initialProjects }: ProjectsListProps) {
  const [projects, setProjects] = useState(initialProjects)

  function handleProjectUpdated(updatedProject: ProjectRow) {
    setProjects((currentProjects) =>
      currentProjects
        .map((project) =>
          project.id === updatedProject.id ? updatedProject : project
        )
        .sort((firstProject, secondProject) =>
          firstProject.name.localeCompare(secondProject.name)
        )
    )
  }

  function handleProjectDeleted(projectId: string) {
    setProjects((currentProjects) =>
      currentProjects.filter((project) => project.id !== projectId)
    )
  }

  function handleProjectCreated(project: ProjectRow) {
    setProjects((currentProjects) =>
      [...currentProjects, project].sort((firstProject, secondProject) =>
        firstProject.name.localeCompare(secondProject.name)
      )
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <CreateProjectDialog
          companyId={companyId}
          onCreated={handleProjectCreated}
        />
      </div>
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
              <ProjectActions
                project={project}
                onDeleted={handleProjectDeleted}
                onUpdated={handleProjectUpdated}
              />
            </div>
          </Card>
        ))
      ) : (
        <p className="rounded-2xl bg-muted p-6 text-sm text-muted-foreground md:col-span-2 xl:col-span-3">
          No projects yet.
        </p>
      )}
      </div>
    </div>
  )
}

type ProjectActionsProps = {
  project: ProjectRow
  onDeleted: (projectId: string) => void
  onUpdated: (project: ProjectRow) => void
}

function ProjectActions({
  project,
  onDeleted,
  onUpdated,
}: ProjectActionsProps) {
  const [renameOpen, setRenameOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [renameError, setRenameError] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [isRenamePending, startRenameTransition] = useTransition()
  const [isDeletePending, startDeleteTransition] = useTransition()

  function renameAction(formData: FormData) {
    setRenameError(null)
    startRenameTransition(async () => {
      const result = await renameProjectAction(project.id, formData)

      if (!result.ok) {
        setRenameError(result.error)
        return
      }

      onUpdated(result.project)
      setRenameOpen(false)
    })
  }

  function deleteAction() {
    setDeleteError(null)
    startDeleteTransition(async () => {
      const result = await deleteProjectAction(project.id)

      if (!result.ok) {
        setDeleteError(result.error)
        return
      }

      onDeleted(result.projectId)
      setDeleteOpen(false)
    })
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
            {renameError ? (
              <p className="text-sm text-destructive">{renameError}</p>
            ) : null}
            <Button disabled={isRenamePending} type="submit">
              {isRenamePending ? "Saving..." : "Save name"}
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
          {deleteError ? (
            <p className="text-sm text-destructive">{deleteError}</p>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <form action={deleteAction}>
              <AlertDialogAction disabled={isDeletePending} variant="destructive" type="submit">
                {isDeletePending ? "Deleting..." : "Delete"}
              </AlertDialogAction>
            </form>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
