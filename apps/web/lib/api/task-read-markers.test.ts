import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { Status } from "@/generated/prisma/enums"
import { getStoredSummaryUpdatedAt, serializeTaskReadMarkers } from "./task-read-markers"

const markerAgent = { AgentId: "main" }

describe("Agent API task serialization", () => {
  it("returns stored summaryUpdatedAt for noted tasks without taskUpdatedAt fallback", () => {
    const taskUpdatedAt = new Date("2026-05-15T10:00:00.000Z")

    assert.equal(
      getStoredSummaryUpdatedAt({ note: "summary", summaryUpdatedAt: null }),
      null
    )

    const serialized = serializeTaskReadMarkers({
      id: "task-1",
      name: "Task",
      job: "Do work",
      status: Status.done,
      note: "summary",
      summaryUpdatedAt: null,
      taskUpdatedAt,
      readMarkers: [
        { status: Status.done, readAt: taskUpdatedAt, agent: markerAgent },
        { status: Status.todo, readAt: taskUpdatedAt, agent: { AgentId: "kaito" } },
      ],
    })

    assert.equal(serialized.summaryUpdatedAt, null)
    assert.deepEqual(serialized.readBy, ["main"])
  })

  it("clears summaryUpdatedAt when the note is absent", () => {
    const staleSummaryTimestamp = new Date("2026-05-15T10:00:00.000Z")

    assert.equal(
      getStoredSummaryUpdatedAt({ note: null, summaryUpdatedAt: staleSummaryTimestamp }),
      null
    )
  })
})
