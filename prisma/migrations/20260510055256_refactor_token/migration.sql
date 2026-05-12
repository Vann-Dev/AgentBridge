/*
  Historical compatibility note:

  This migration originally added required Agent.AgentId and
  Company.bearerTokenHash columns without defaults, which fails when replayed
  against non-empty pre-refactor databases. The deterministic backfill below
  preserves migration replay safety without exposing real bearer tokens.
  Operators should rotate the generated company token after upgrading any
  legacy database that crossed this migration boundary.
*/
-- DropIndex
DROP INDEX "Agent_bearerTokenHash_key";

-- AlterTable
ALTER TABLE "Agent" DROP COLUMN "bearerTokenHash",
ADD COLUMN     "AgentId" TEXT;

-- Backfill stable AgentId values for legacy rows before enforcing NOT NULL.
UPDATE "Agent"
SET "AgentId" = 'legacy-' || "id"::text
WHERE "AgentId" IS NULL;

ALTER TABLE "Agent" ALTER COLUMN "AgentId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "bearerTokenHash" TEXT;

-- Backfill deterministic unique placeholders for legacy company rows.
UPDATE "Company"
SET "bearerTokenHash" = 'legacy-company-token-' || "id"::text
WHERE "bearerTokenHash" IS NULL;

ALTER TABLE "Company" ALTER COLUMN "bearerTokenHash" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Agent_AgentId_key" ON "Agent"("AgentId");

-- CreateIndex
CREATE UNIQUE INDEX "Company_bearerTokenHash_key" ON "Company"("bearerTokenHash");
