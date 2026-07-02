-- CreateEnum
CREATE TYPE "AccountingType" AS ENUM ('ENTREE', 'SORTIE');

-- CreateTable
CREATE TABLE "accounting_entries" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "type" "AccountingType" NOT NULL,
    "category" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "paymentMode" "PaymentMode" NOT NULL DEFAULT 'ESPECES',
    "note" TEXT,
    "enteredById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "accounting_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "accounting_entries_date_idx" ON "accounting_entries"("date");

-- CreateIndex
CREATE INDEX "accounting_entries_type_idx" ON "accounting_entries"("type");

-- AddForeignKey
ALTER TABLE "accounting_entries" ADD CONSTRAINT "accounting_entries_enteredById_fkey" FOREIGN KEY ("enteredById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
