-- AlterTable
ALTER TABLE "repository" ADD COLUMN     "provider" TEXT NOT NULL DEFAULT 'github';

-- CreateTable
CREATE TABLE "device_code" (
    "id" TEXT NOT NULL,
    "userCode" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "userId" TEXT,
    "apiKey" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "device_code_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "device_code_userCode_key" ON "device_code"("userCode");

