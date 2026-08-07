-- Spec 0006: per-run indexing telemetry for dashboard metrics + alerting.
CREATE TABLE "index_run" (
    "id" TEXT NOT NULL,
    "repositoryId" TEXT NOT NULL,
    "runAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "fileDelta" INTEGER,
    "error" TEXT,
    "durationMs" INTEGER,

    CONSTRAINT "index_run_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "index_run_repositoryId_idx" ON "index_run"("repositoryId");
CREATE INDEX "index_run_runAt_idx" ON "index_run"("runAt");

ALTER TABLE "index_run" ADD CONSTRAINT "index_run_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "repository"("id") ON DELETE CASCADE ON UPDATE CASCADE;
