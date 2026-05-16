import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { Status } from "@/generated/prisma/enums"

import { serializeTaskDependencies } from "./task-dependencies"

describe("Agent API task visibility", () => {
  it("omits archived dependency and unblocks tasks from serialized task payloads", () => {
    const activeDependency = {
      id: "dependency-active",
      name: "Active dependency",
      status: Status.done,
      archivedAt: null,
    }
    const archivedDependency = {
      id: "dependency-archived",
      name: "Archived dependency",
      status: Status.done,
      archivedAt: new Date("2026-05-16T07:00:00.000Z"),
    }
    const activeBlockedTask = {
      id: "blocked-active",
      name: "Active blocked task",
      status: Status.todo,
      archivedAt: null,
    }
    const archivedBlockedTask = {
      id: "blocked-archived",
      name: "Archived blocked task",
      status: Status.todo,
      archivedAt: new Date("2026-05-16T07:00:00.000Z"),
    }

    const result = serializeTaskDependencies({
      id: "task-1",
      blockedByDependencies: [
        { dependencyTask: activeDependency },
        { dependencyTask: archivedDependency },
      ],
      unblocksDependencies: [
        { blockedTask: activeBlockedTask },
        { blockedTask: archivedBlockedTask },
      ],
    })

    assert.deepEqual(result.dependencies, [activeDependency])
    assert.deepEqual(result.dependencyIds, [activeDependency.id])
    assert.deepEqual(result.unblocks, [activeBlockedTask])
    assert.equal(result.isDependencyReady, true)
  })

  it("does not mark dependency readiness from archived dependencies", () => {
    const result = serializeTaskDependencies({
      id: "task-1",
      blockedByDependencies: [
        {
          dependencyTask: {
            id: "dependency-archived",
            name: "Archived dependency",
            status: Status.done,
            archivedAt: new Date("2026-05-16T07:00:00.000Z"),
          },
        },
      ],
      unblocksDependencies: [],
    })

    assert.deepEqual(result.dependencies, [])
    assert.deepEqual(result.dependencyIds, [])
    assert.equal(result.isDependencyReady, false)
  })
})
