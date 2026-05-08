/*
  Warnings:

  - A unique constraint covering the columns `[bearerTokenHash]` on the table `Agent` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `bearerTokenHash` to the `Agent` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Agent" ADD COLUMN     "bearerTokenHash" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Agent_bearerTokenHash_key" ON "Agent"("bearerTokenHash");
