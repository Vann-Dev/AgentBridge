-- Add compact task freshness metadata for dashboard cards and Agent API responses.
ALTER TABLE "Task"
  ADD COLUMN "taskUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "taskUpdatedById" UUID,
  ADD COLUMN "taskUpdatedByName" TEXT,
  ADD COLUMN "taskUpdatedByType" TEXT NOT NULL DEFAULT 'system';
