-- Backfill deterministic summary timestamps for legacy completed task notes.
-- Some done tasks were created with note text before summaryUpdatedAt existed or was
-- consistently written. Use the task's last update timestamp instead of CURRENT_TIMESTAMP
-- so existing read markers newer than the legacy note stay read.
UPDATE "Task"
SET "summaryUpdatedAt" = "taskUpdatedAt"
WHERE "note" IS NOT NULL
  AND "summaryUpdatedAt" IS NULL;
