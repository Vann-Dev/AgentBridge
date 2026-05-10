-- CreateTable
CREATE TABLE "TaskReadMarker" (
    "id" UUID NOT NULL,
    "status" "Status" NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "taskId" UUID NOT NULL,
    "agentId" UUID NOT NULL,

    CONSTRAINT "TaskReadMarker_pkey" PRIMARY KEY ("id")
);

-- Preserve existing Natsuki/main done-card read markers when a matching agent exists.
INSERT INTO "TaskReadMarker" ("id", "status", "readAt", "taskId", "agentId")
SELECT gen_random_uuid(), "Task"."status", "Task"."natsukiReadAt", "Task"."id", "Agent"."id"
FROM "Task"
JOIN "Project" ON "Project"."id" = "Task"."projectId"
JOIN "Agent" ON "Agent"."companyId" = "Project"."companyId" AND "Agent"."AgentId" = 'natsuki'
WHERE "Task"."natsukiReadAt" IS NOT NULL;

-- AlterTable
ALTER TABLE "Task" DROP COLUMN "natsukiReadAt";

-- CreateIndex
CREATE INDEX "TaskReadMarker_agentId_idx" ON "TaskReadMarker"("agentId");

-- CreateIndex
CREATE UNIQUE INDEX "TaskReadMarker_taskId_agentId_status_key" ON "TaskReadMarker"("taskId", "agentId", "status");

-- AddForeignKey
ALTER TABLE "TaskReadMarker" ADD CONSTRAINT "TaskReadMarker_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskReadMarker" ADD CONSTRAINT "TaskReadMarker_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
