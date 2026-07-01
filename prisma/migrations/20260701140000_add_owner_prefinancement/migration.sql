CREATE TABLE "owner_prefinancements" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "weekStart" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "note" TEXT,
    "enteredById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "owner_prefinancements_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "owner_prefinancements_ownerId_weekStart_key" ON "owner_prefinancements"("ownerId", "weekStart");

ALTER TABLE "owner_prefinancements" ADD CONSTRAINT "owner_prefinancements_ownerId_fkey"
    FOREIGN KEY ("ownerId") REFERENCES "owners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "owner_prefinancements" ADD CONSTRAINT "owner_prefinancements_enteredById_fkey"
    FOREIGN KEY ("enteredById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
