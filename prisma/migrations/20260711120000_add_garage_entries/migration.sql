-- CreateEnum
CREATE TYPE "GarageReasonType" AS ENUM ('PANNE', 'REPARATION', 'ENTRETIEN', 'ACCIDENT', 'AUTRE');

-- CreateTable
CREATE TABLE "garage_entries" (
    "id" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "reasonType" "GarageReasonType" NOT NULL,
    "reason" TEXT NOT NULL,
    "enteredAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "note" TEXT,
    "enteredById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "garage_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "garage_entries_driverId_idx" ON "garage_entries"("driverId");

-- CreateIndex
CREATE INDEX "garage_entries_resolvedAt_idx" ON "garage_entries"("resolvedAt");

-- AddForeignKey
ALTER TABLE "garage_entries" ADD CONSTRAINT "garage_entries_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "drivers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "garage_entries" ADD CONSTRAINT "garage_entries_enteredById_fkey" FOREIGN KEY ("enteredById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
