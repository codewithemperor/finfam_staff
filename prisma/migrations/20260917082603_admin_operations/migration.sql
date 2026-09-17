-- CreateEnum
CREATE TYPE "AdminAccountStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "AdminAuditAction" AS ENUM ('STAFF_SUSPENDED', 'STAFF_REACTIVATED');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'ADMIN_LOGIN_CODE';

-- CreateTable
CREATE TABLE "admin_accounts" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "status" "AdminAccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_login_codes" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_login_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_sessions" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3),

    CONSTRAINT "admin_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_audit_events" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" "AdminAuditAction" NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "reason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "admin_accounts_email_key" ON "admin_accounts"("email");

-- CreateIndex
CREATE INDEX "admin_login_codes_accountId_createdAt_idx" ON "admin_login_codes"("accountId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "admin_sessions_tokenHash_key" ON "admin_sessions"("tokenHash");

-- CreateIndex
CREATE INDEX "admin_sessions_accountId_idx" ON "admin_sessions"("accountId");

-- CreateIndex
CREATE INDEX "admin_audit_events_createdAt_idx" ON "admin_audit_events"("createdAt");

-- CreateIndex
CREATE INDEX "admin_audit_events_actorId_createdAt_idx" ON "admin_audit_events"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "daily_reports_reportDate_idx" ON "daily_reports"("reportDate");

-- AddForeignKey
ALTER TABLE "admin_login_codes" ADD CONSTRAINT "admin_login_codes_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "admin_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_sessions" ADD CONSTRAINT "admin_sessions_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "admin_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_audit_events" ADD CONSTRAINT "admin_audit_events_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "admin_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
