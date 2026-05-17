import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { getDoneSummaryReviewReadMarkerWhere, isDoneSummaryUnread } from "./note-read-state"

describe("dashboard done summary read state", () => {
  it("treats noted done tasks with unknown summary freshness as unread", () => {
    assert.equal(
      isDoneSummaryUnread({
        readAt: new Date("2026-05-15T12:00:00.000Z"),
        summaryUpdatedAt: null,
      }),
      true
    )
  })

  it("compares read markers only against stored summary freshness", () => {
    const summaryUpdatedAt = new Date("2026-05-15T12:00:00.000Z")

    assert.equal(
      isDoneSummaryUnread({
        readAt: new Date("2026-05-15T11:59:59.000Z"),
        summaryUpdatedAt,
      }),
      true
    )
    assert.equal(
      isDoneSummaryUnread({
        readAt: new Date("2026-05-15T12:00:00.000Z"),
        summaryUpdatedAt,
      }),
      false
    )
  })
  it("scopes project-card done summary reads to the resolved review reader", () => {
    assert.deepEqual(getDoneSummaryReviewReadMarkerWhere({ id: "agent-natsuki" }), {
      status: "done",
      agentId: "agent-natsuki",
    })
  })
})
