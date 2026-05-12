/*
  Historical compatibility note:

  This migration originally added Agent.bearerTokenHash as NOT NULL without a
  default, which fails when replayed against pre-token AgentBridge databases
  that already contain Agent rows. The column is removed by
  20260510055256_refactor_token, so the placeholder below only makes legacy
  migration replay possible and is not used by the current application model.
*/
-- AlterTable
ALTER TABLE "Agent" ADD COLUMN     "bearerTokenHash" TEXT;

-- Backfill deterministic unique placeholders for legacy non-empty databases.
UPDATE "Agent"
SET "bearerTokenHash" = 'legacy-agent-token-' || "id"::text
WHERE "bearerTokenHash" IS NULL;

-- Enforce the intended required constraint after backfill.
ALTER TABLE "Agent" ALTER COLUMN "bearerTokenHash" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Agent_bearerTokenHash_key" ON "Agent"("bearerTokenHash");
