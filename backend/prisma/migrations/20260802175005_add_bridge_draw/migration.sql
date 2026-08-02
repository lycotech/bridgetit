-- CreateTable
CREATE TABLE "BridgeDraw" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "employeeRecordId" TEXT NOT NULL,
    "employerId" TEXT NOT NULL,
    "limitId" TEXT NOT NULL,
    "cycleId" TEXT,
    "reference" TEXT NOT NULL,
    "requestedAmount" DECIMAL(18,2) NOT NULL,
    "approvedAmount" DECIMAL(18,2),
    "status" TEXT NOT NULL DEFAULT 'requested',
    "rejectionReason" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),
    "decidedBy" TEXT,
    "decidedByLabel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BridgeDraw_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BridgeDraw_reference_key" ON "BridgeDraw"("reference");

-- CreateIndex
CREATE INDEX "BridgeDraw_userId_status_idx" ON "BridgeDraw"("userId", "status");

-- CreateIndex
CREATE INDEX "BridgeDraw_employerId_status_idx" ON "BridgeDraw"("employerId", "status");

-- CreateIndex
CREATE INDEX "BridgeDraw_limitId_idx" ON "BridgeDraw"("limitId");

-- AddForeignKey
ALTER TABLE "BridgeDraw" ADD CONSTRAINT "BridgeDraw_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BridgeDraw" ADD CONSTRAINT "BridgeDraw_employeeRecordId_fkey" FOREIGN KEY ("employeeRecordId") REFERENCES "EmployeeRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BridgeDraw" ADD CONSTRAINT "BridgeDraw_employerId_fkey" FOREIGN KEY ("employerId") REFERENCES "Employer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BridgeDraw" ADD CONSTRAINT "BridgeDraw_limitId_fkey" FOREIGN KEY ("limitId") REFERENCES "CreditLimit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BridgeDraw" ADD CONSTRAINT "BridgeDraw_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "PayrollCycle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

