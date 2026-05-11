-- Link agents to projects so task assignment can be scoped per project.
CREATE TABLE "ProjectAgent" (
    "id" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "projectId" UUID NOT NULL,
    "agentId" UUID NOT NULL,

    CONSTRAINT "ProjectAgent_pkey" PRIMARY KEY ("id")
);

-- Backfill existing assignments so current task assignees remain valid project members.
INSERT INTO "ProjectAgent" ("id", "projectId", "agentId")
SELECT gen_random_uuid(), "Task"."projectId", "Task"."assignedAgentId"
FROM "Task"
GROUP BY "Task"."projectId", "Task"."assignedAgentId";

CREATE UNIQUE INDEX "ProjectAgent_projectId_agentId_key" ON "ProjectAgent"("projectId", "agentId");
CREATE INDEX "ProjectAgent_agentId_idx" ON "ProjectAgent"("agentId");

ALTER TABLE "ProjectAgent" ADD CONSTRAINT "ProjectAgent_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectAgent" ADD CONSTRAINT "ProjectAgent_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
