-- AlterTable
ALTER TABLE "repository" ADD COLUMN "orgId" TEXT;

-- CreateIndex
CREATE INDEX "repository_orgId_idx" ON "repository"("orgId");
