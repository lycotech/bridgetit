-- AlterTable
ALTER TABLE "EmployeeRecord" ADD COLUMN     "payrollAccountLast4" TEXT,
ADD COLUMN     "payrollAccountNameEnc" TEXT,
ADD COLUMN     "payrollAccountNumberEnc" TEXT,
ADD COLUMN     "payrollAccountSource" TEXT,
ADD COLUMN     "payrollAccountUpdatedAt" TIMESTAMP(3),
ADD COLUMN     "payrollBankName" TEXT;

-- AlterTable
ALTER TABLE "Employer" ADD COLUMN     "payrollModel" TEXT NOT NULL DEFAULT 'existing_payroll',
ADD COLUMN     "salaryAccountsActive" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "SalaryAccountRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "employeeRecordId" TEXT NOT NULL,
    "employerId" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "currentBankName" TEXT,
    "currentAccountLast4" TEXT,
    "newBankName" TEXT NOT NULL,
    "newAccountNameEnc" TEXT NOT NULL,
    "newAccountNumberEnc" TEXT NOT NULL,
    "newAccountLast4" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending_review',
    "rejectionReason" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),
    "decidedBy" TEXT,
    "decidedByLabel" TEXT,
    "consentSignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "consentDeviceRef" TEXT,
    "consentReferenceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalaryAccountRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SalaryAccountRequest_reference_key" ON "SalaryAccountRequest"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "SalaryAccountRequest_consentReferenceId_key" ON "SalaryAccountRequest"("consentReferenceId");

-- CreateIndex
CREATE INDEX "SalaryAccountRequest_employerId_status_idx" ON "SalaryAccountRequest"("employerId", "status");

-- CreateIndex
CREATE INDEX "SalaryAccountRequest_userId_status_idx" ON "SalaryAccountRequest"("userId", "status");

-- CreateIndex
CREATE INDEX "SalaryAccountRequest_employeeRecordId_status_idx" ON "SalaryAccountRequest"("employeeRecordId", "status");

-- AddForeignKey
ALTER TABLE "SalaryAccountRequest" ADD CONSTRAINT "SalaryAccountRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalaryAccountRequest" ADD CONSTRAINT "SalaryAccountRequest_employeeRecordId_fkey" FOREIGN KEY ("employeeRecordId") REFERENCES "EmployeeRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalaryAccountRequest" ADD CONSTRAINT "SalaryAccountRequest_employerId_fkey" FOREIGN KEY ("employerId") REFERENCES "Employer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
