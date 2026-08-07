-- Spec 0003: per-seat org billing & invites.
-- Organization gains a Polar customer + subscription; members gain a
-- pending-invite lifecycle (status, invitedEmail, inviteToken, invitedAt).

-- AlterTable: organization
ALTER TABLE "organization" ADD COLUMN     "polarCustomerId" TEXT,
ADD COLUMN     "polarSubscriptionId" TEXT;

-- AlterTable: organization_member
-- userId becomes nullable so a pending invite (no account yet) can exist.
-- Existing rows keep their user ids; NULLs are distinct in the unique
-- constraint, so multiple pending invites per org are allowed.
ALTER TABLE "organization_member" ALTER COLUMN "userId" DROP NOT NULL,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'active',
ADD COLUMN     "invitedEmail" TEXT,
ADD COLUMN     "inviteToken" TEXT,
ADD COLUMN     "invitedAt" TIMESTAMP(3);

-- CreateIndex: inviteToken is single-use and looked up by value
CREATE UNIQUE INDEX "organization_member_inviteToken_key" ON "organization_member"("inviteToken");

-- CreateIndex: webhook lookups by Polar customer id (one customer per org)
CREATE UNIQUE INDEX "organization_polarCustomerId_key" ON "organization"("polarCustomerId");
