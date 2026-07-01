-- CreateTable owners
CREATE TABLE "owners" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "location" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "owners_pkey" PRIMARY KEY ("id")
);

-- CreateTable owner_commissions
CREATE TABLE "owner_commissions" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "weekStart" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "note" TEXT,
    "enteredById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "owner_commissions_pkey" PRIMARY KEY ("id")
);

-- UniqueConstraint
CREATE UNIQUE INDEX "owner_commissions_ownerId_weekStart_key" ON "owner_commissions"("ownerId", "weekStart");

-- AddColumn ownerId to drivers
ALTER TABLE "drivers" ADD COLUMN "ownerId" TEXT;

-- AddForeignKey
ALTER TABLE "owner_commissions" ADD CONSTRAINT "owner_commissions_ownerId_fkey"
    FOREIGN KEY ("ownerId") REFERENCES "owners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "owner_commissions" ADD CONSTRAINT "owner_commissions_enteredById_fkey"
    FOREIGN KEY ("enteredById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "drivers" ADD CONSTRAINT "drivers_ownerId_fkey"
    FOREIGN KEY ("ownerId") REFERENCES "owners"("id") ON DELETE SET NULL ON UPDATE CASCADE;
