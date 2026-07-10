-- CreateEnum
CREATE TYPE "BusinessUnit" AS ENUM ('EMPIRE_ASSURANCE', 'AUTO_ECOLE_EMPIRE', 'EMPIRE_LANGUAGE_ACADEMY', 'EMPIRE_TRAVEL', 'EMPIRE_DRIVE', 'EMPIRE_SECURE');

-- CreateEnum
CREATE TYPE "StockMovementType" AS ENUM ('APPRO', 'VENTE', 'AJUSTEMENT');

-- AlterTable
ALTER TABLE "accounting_entries" ADD COLUMN "businessUnit" "BusinessUnit";

-- CreateIndex
CREATE INDEX "accounting_entries_businessUnit_idx" ON "accounting_entries"("businessUnit");

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "businessUnit" "BusinessUnit" NOT NULL,
    "name" TEXT NOT NULL,
    "unitPrice" DECIMAL(14,2) NOT NULL,
    "quantityInStock" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "products_businessUnit_idx" ON "products"("businessUnit");

-- CreateTable
CREATE TABLE "stock_movements" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "type" "StockMovementType" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(14,2) NOT NULL,
    "totalAmount" DECIMAL(14,2) NOT NULL,
    "resultStock" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "enteredById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "accountingEntryId" TEXT,

    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "stock_movements_accountingEntryId_key" ON "stock_movements"("accountingEntryId");

-- CreateIndex
CREATE INDEX "stock_movements_productId_idx" ON "stock_movements"("productId");

-- CreateTable
CREATE TABLE "structure_assignments" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "businessUnit" "BusinessUnit" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "structure_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "structure_assignments_userId_businessUnit_key" ON "structure_assignments"("userId", "businessUnit");

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_enteredById_fkey" FOREIGN KEY ("enteredById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_accountingEntryId_fkey" FOREIGN KEY ("accountingEntryId") REFERENCES "accounting_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "structure_assignments" ADD CONSTRAINT "structure_assignments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
