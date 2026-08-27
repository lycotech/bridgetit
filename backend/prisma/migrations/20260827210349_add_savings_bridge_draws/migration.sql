-- CreateTable
CREATE TABLE "SavingsBridgeDraw" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "goalId" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "requestedAmount" DECIMAL(18,2) NOT NULL,
    "approvedAmount" DECIMAL(18,2),
    "eligibleAmount" DECIMAL(18,2) NOT NULL,
    "feeAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'requested',
    "rejectionReason" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),
    "decidedBy" TEXT,
    "decidedByLabel" TEXT,
    "withdrawalTransactionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavingsBridgeDraw_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SavingsBridgeDraw_reference_key" ON "SavingsBridgeDraw"("reference");

-- CreateIndex
CREATE INDEX "SavingsBridgeDraw_userId_status_idx" ON "SavingsBridgeDraw"("userId", "status");

-- CreateIndex
CREATE INDEX "SavingsBridgeDraw_goalId_idx" ON "SavingsBridgeDraw"("goalId");

-- AddForeignKey
ALTER TABLE "SavingsBridgeDraw" ADD CONSTRAINT "SavingsBridgeDraw_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavingsBridgeDraw" ADD CONSTRAINT "SavingsBridgeDraw_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "SavingsGoal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
