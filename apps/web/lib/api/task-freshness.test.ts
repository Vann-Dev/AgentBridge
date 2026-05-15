import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { Status } from "@/generated/prisma/enums"
import { validateAgentTaskPatchInput } from "./agent-task-validation"
import { getTaskFreshnessUpdate } from "./task-freshness"

describe("Agent API task freshness updates", () => {
  it("sets summaryUpdatedAt and clears current-status read markers when the note changes", () => {
    const now = new Date("2026-05-13T13:00:00.000Z")
    const result = getTaskFreshnessUpdate({
      currentStatus: Status.done,
      currentNote: "old summary",
      nextNote: "new summary",
      hasReadBy: false,
      now,
    })

    assert.equal(result.noteChanged, true)
    assert.equal(result.statusChanged, false)
    assert.equal(result.shouldClearNextStatusReads, true)
    assert.equal(result.summaryUpdatedAt, now)
  })

  it("preserves summaryUpdatedAt and read markers when the note is unchanged", () => {
    const result = getTaskFreshnessUpdate({
      currentStatus: Status.done,
      currentNote: "same summary",
      nextNote: "same summary",
      hasReadBy: false,
      now: new Date("2026-05-13T13:00:00.000Z"),
    })

    assert.equal(result.noteChanged, false)
    assert.equal(result.shouldClearNextStatusReads, false)
    assert.equal("summaryUpdatedAt" in result, false)
  })

  it("clears read markers for the resulting status when status changes and readBy is omitted", () => {
    const result = getTaskFreshnessUpdate({
      currentStatus: Status.inprogress,
      currentNote: null,
      nextStatus: Status.done,
      hasReadBy: false,
    })

    assert.equal(result.nextStatus, Status.done)
    assert.equal(result.statusChanged, true)
    assert.equal(result.shouldClearNextStatusReads, true)
  })

  it("does not clear resulting-status read markers when readBy is provided", () => {
    const result = getTaskFreshnessUpdate({
      currentStatus: Status.inprogress,
      currentNote: null,
      nextStatus: Status.done,
      nextNote: "finished",
      hasReadBy: true,
    })

    assert.equal(result.noteChanged, true)
    assert.equal(result.statusChanged, true)
    assert.equal(result.shouldClearNextStatusReads, false)
  })

  it("treats a blank note as a cleared summary", () => {
    const result = getTaskFreshnessUpdate({
      currentStatus: Status.done,
      currentNote: "old summary",
      nextNote: null,
      hasReadBy: false,
      now: new Date("2026-05-13T13:00:00.000Z"),
    })

    assert.equal(result.noteChanged, true)
    assert.equal(result.shouldClearNextStatusReads, true)
    assert.equal(result.summaryUpdatedAt, null)
  })
})

describe("Agent API task patch validation", () => {
  it("trims note summaries and readBy AgentIds for a valid mutation", () => {
    assert.deepEqual(
      validateAgentTaskPatchInput({
        status: Status.done,
        note: "  shipped summary  ",
        readBy: ["main", "main", "kaito"],
      }),
      {
        ok: true,
        data: { status: Status.done, note: "shipped summary" },
        readBy: ["main", "kaito"],
        hasReadBy: true,
      }
    )
  })

  it("returns stable error strings for invalid task mutations", () => {
    assert.deepEqual(validateAgentTaskPatchInput({ status: "ready" }), {
      ok: false,
      error: "Invalid task status",
    })
    assert.deepEqual(validateAgentTaskPatchInput({ note: 42 }), {
      ok: false,
      error: "Invalid task note",
    })
    assert.deepEqual(validateAgentTaskPatchInput({ readBy: ["main", ""] }), {
      ok: false,
      error: "Invalid read markers",
    })
    assert.deepEqual(validateAgentTaskPatchInput({}), {
      ok: false,
      error: "No task updates provided",
    })
  })
})
