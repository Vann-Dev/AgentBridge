/*
  Warnings:

  - You are about to drop the column `bearerTokenHash` on the `Agent` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[AgentId]` on the table `Agent` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[bearerTokenHash]` on the table `Company` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `AgentId` to the `Agent` table without a default value. This is not possible if the table is not empty.
  - Added the required column `bearerTokenHash` to the `Company` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "Agent_bearerTokenHash_key";

-- AlterTable
ALTER TABLE "Agent" DROP COLUMN "bearerTokenHash",
ADD COLUMN     "AgentId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "bearerTokenHash" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Agent_AgentId_key" ON "Agent"("AgentId");

-- CreateIndex
CREATE UNIQUE INDEX "Company_bearerTokenHash_key" ON "Company"("bearerTokenHash");
