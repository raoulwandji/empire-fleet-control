-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "inactivityReason" TEXT,
ADD COLUMN     "isInactive" BOOLEAN NOT NULL DEFAULT false;
