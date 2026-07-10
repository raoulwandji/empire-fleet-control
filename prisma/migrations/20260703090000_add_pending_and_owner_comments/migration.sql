-- CreateTable
CREATE TABLE "pending_driver_comments" (
    "id" TEXT NOT NULL,
    "pendingDriverId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pending_driver_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "owner_comments" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "owner_comments_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "pending_driver_comments" ADD CONSTRAINT "pending_driver_comments_pendingDriverId_fkey" FOREIGN KEY ("pendingDriverId") REFERENCES "pending_drivers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pending_driver_comments" ADD CONSTRAINT "pending_driver_comments_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "owner_comments" ADD CONSTRAINT "owner_comments_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "owners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "owner_comments" ADD CONSTRAINT "owner_comments_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
