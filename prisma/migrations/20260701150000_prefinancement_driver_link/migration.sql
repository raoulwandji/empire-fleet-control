-- Drop old unique constraint (one prefinancement per owner per week)
DROP INDEX IF EXISTS "owner_prefinancements_ownerId_weekStart_key";

-- Add driverId column
ALTER TABLE "owner_prefinancements" ADD COLUMN "driverId" TEXT;

-- Add FK to drivers
ALTER TABLE "owner_prefinancements" ADD CONSTRAINT "owner_prefinancements_driverId_fkey"
    FOREIGN KEY ("driverId") REFERENCES "drivers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
