-- Add completion-summary freshness and task dependency edges.
ALTER TABLE "Task" ADD COLUMN "summaryUpdatedAt" TIMESTAMP(3);

CREATE TABLE "TaskDependency" (
    "id" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "blockedTaskId" UUID NOT NULL,
    "dependencyTaskId" UUID NOT NULL,

    CONSTRAINT "TaskDependency_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TaskDependency_blockedTaskId_dependencyTaskId_key" ON "TaskDependency"("blockedTaskId", "dependencyTaskId");
CREATE INDEX "TaskDependency_dependencyTaskId_idx" ON "TaskDependency"("dependencyTaskId");

ALTER TABLE "TaskDependency" ADD CONSTRAINT "TaskDependency_blockedTaskId_fkey" FOREIGN KEY ("blockedTaskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TaskDependency" ADD CONSTRAINT "TaskDependency_dependencyTaskId_fkey" FOREIGN KEY ("dependencyTaskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

UPDATE "Task"
SET "summaryUpdatedAt" = CURRENT_TIMESTAMP
WHERE "note" IS NOT NULL;
