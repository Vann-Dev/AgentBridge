import { Status } from "@/generated/prisma/enums"

type DependencyTask = {
  id: string
  name: string
  status: Status
  archivedAt?: Date | null
}

type SerializedDependencyTask = Omit<DependencyTask, "archivedAt">

type DependencyEdge = {
  dependencyTask: DependencyTask
}

type UnblocksEdge = {
  blockedTask: DependencyTask
}

export type TaskDependencyPayload = {
  blockedByDependencies?: DependencyEdge[]
  unblocksDependencies?: UnblocksEdge[]
}

export function serializeTaskDependencies<T extends TaskDependencyPayload>(task: T) {
  const { blockedByDependencies, unblocksDependencies, ...rest } = task
  const dependencies =
    blockedByDependencies
      ?.map((dependency) => serializeDependencyTask(dependency.dependencyTask))
      .filter((dependency): dependency is SerializedDependencyTask => dependency !== null) ?? []
  const unblocks =
    unblocksDependencies
      ?.map((dependency) => serializeDependencyTask(dependency.blockedTask))
      .filter((dependency): dependency is SerializedDependencyTask => dependency !== null) ?? []

  return {
    ...rest,
    dependencies,
    dependencyIds: dependencies.map((dependency) => dependency.id),
    unblocks,
    isDependencyReady: dependencies.length > 0 && dependencies.every((dependency) => dependency.status === Status.done),
  }
}

function serializeDependencyTask(task: DependencyTask): SerializedDependencyTask | null {
  if (task.archivedAt) {
    return null
  }

  return {
    id: task.id,
    name: task.name,
    status: task.status,
  }
}

export function hasDependencyCycle(
  edges: Array<{ blockedTaskId: string; dependencyTaskId: string }>,
  blockedTaskId: string,
  dependencyTaskIds: string[]
) {
  const dependenciesByTask = new Map<string, string[]>()

  for (const edge of edges) {
    const dependencies = dependenciesByTask.get(edge.blockedTaskId) ?? []
    dependencies.push(edge.dependencyTaskId)
    dependenciesByTask.set(edge.blockedTaskId, dependencies)
  }

  dependenciesByTask.set(blockedTaskId, dependencyTaskIds)

  for (const dependencyTaskId of dependencyTaskIds) {
    if (canReachTask(dependenciesByTask, dependencyTaskId, blockedTaskId, new Set())) {
      return true
    }
  }

  return false
}

function canReachTask(
  dependenciesByTask: Map<string, string[]>,
  currentTaskId: string,
  targetTaskId: string,
  seen: Set<string>
): boolean {
  if (currentTaskId === targetTaskId) return true
  if (seen.has(currentTaskId)) return false

  seen.add(currentTaskId)

  return (dependenciesByTask.get(currentTaskId) ?? []).some((dependencyTaskId) =>
    canReachTask(dependenciesByTask, dependencyTaskId, targetTaskId, seen)
  )
}
