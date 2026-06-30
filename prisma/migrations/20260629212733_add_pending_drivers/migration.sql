-- CreateTable
CREATE TABLE "pending_drivers" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "location" TEXT,
    "licenseNumber" TEXT,
    "contractType" "ContractType" NOT NULL,
    "cautionPaid" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "comment" TEXT,
    "enteredById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pending_drivers_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "pending_drivers" ADD CONSTRAINT "pending_drivers_enteredById_fkey" FOREIGN KEY ("enteredById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
