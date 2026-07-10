-- CreateTable
CREATE TABLE "pending_owners" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "location" TEXT,
    "comment" TEXT,
    "enteredById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pending_owners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pending_owner_comments" (
    "id" TEXT NOT NULL,
    "pendingOwnerId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pending_owner_comments_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "pending_owners" ADD CONSTRAINT "pending_owners_enteredById_fkey" FOREIGN KEY ("enteredById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pending_owner_comments" ADD CONSTRAINT "pending_owner_comments_pendingOwnerId_fkey" FOREIGN KEY ("pendingOwnerId") REFERENCES "pending_owners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pending_owner_comments" ADD CONSTRAINT "pending_owner_comments_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
