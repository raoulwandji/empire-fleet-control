-- AlterTable
ALTER TABLE "owner_commissions" ADD COLUMN "accountingEntryId" TEXT;

-- AlterTable
ALTER TABLE "owner_prefinancements" ADD COLUMN "accountingEntryId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "owner_commissions_accountingEntryId_key" ON "owner_commissions"("accountingEntryId");

-- CreateIndex
CREATE UNIQUE INDEX "owner_prefinancements_accountingEntryId_key" ON "owner_prefinancements"("accountingEntryId");

-- AddForeignKey
ALTER TABLE "owner_commissions" ADD CONSTRAINT "owner_commissions_accountingEntryId_fkey" FOREIGN KEY ("accountingEntryId") REFERENCES "accounting_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "owner_prefinancements" ADD CONSTRAINT "owner_prefinancements_accountingEntryId_fkey" FOREIGN KEY ("accountingEntryId") REFERENCES "accounting_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
