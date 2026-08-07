-- AlterTable: Spec 0002 incremental indexing. Nullable on purpose — a null
-- value means "full index on next run" (backfill not needed).
ALTER TABLE "repository" ADD COLUMN     "lastIndexedCommitSha" TEXT;
