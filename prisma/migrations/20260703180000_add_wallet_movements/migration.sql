-- CreateEnum
CREATE TYPE "WalletMovementType" AS ENUM ('DEPOT', 'RETRAIT');

-- CreateTable
CREATE TABLE "wallet_movements" (
    "id" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "type" "WalletMovementType" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "reason" TEXT,
    "resultBalance" DECIMAL(14,2) NOT NULL,
    "enteredById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wallet_movements_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "wallet_movements" ADD CONSTRAINT "wallet_movements_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "drivers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_movements" ADD CONSTRAINT "wallet_movements_enteredById_fkey" FOREIGN KEY ("enteredById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
