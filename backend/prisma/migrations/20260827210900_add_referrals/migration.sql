-- AlterTable
ALTER TABLE "User" ADD COLUMN     "referralCode" TEXT;

-- CreateTable
CREATE TABLE "Referral" (
    "id" TEXT NOT NULL,
    "referrerUserId" TEXT NOT NULL,
    "referredName" TEXT NOT NULL,
    "referredEmail" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'invited',
    "rewardAmount" DECIMAL(18,2) NOT NULL DEFAULT 2000,
    "invitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "joinedAt" TIMESTAMP(3),
    "joinedUserId" TEXT,
    "rewardTransactionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Referral_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_referralCode_key" ON "User"("referralCode");

-- CreateIndex
CREATE INDEX "Referral_referrerUserId_status_idx" ON "Referral"("referrerUserId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Referral_referrerUserId_referredEmail_key" ON "Referral"("referrerUserId", "referredEmail");

-- AddForeignKey
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_referrerUserId_fkey" FOREIGN KEY ("referrerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_joinedUserId_fkey" FOREIGN KEY ("joinedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
