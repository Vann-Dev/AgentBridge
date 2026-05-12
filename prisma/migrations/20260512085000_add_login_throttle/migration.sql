-- CreateTable
CREATE TABLE "LoginThrottle" (
    "id" UUID NOT NULL,
    "username" TEXT NOT NULL,
    "ipAddress" TEXT NOT NULL,
    "failedAttempts" INTEGER NOT NULL DEFAULT 0,
    "lastFailedAt" TIMESTAMP(3) NOT NULL,
    "lockedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoginThrottle_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LoginThrottle_username_ipAddress_key" ON "LoginThrottle"("username", "ipAddress");

-- CreateIndex
CREATE INDEX "LoginThrottle_ipAddress_lastFailedAt_idx" ON "LoginThrottle"("ipAddress", "lastFailedAt");

-- CreateIndex
CREATE INDEX "LoginThrottle_lockedUntil_idx" ON "LoginThrottle"("lockedUntil");
