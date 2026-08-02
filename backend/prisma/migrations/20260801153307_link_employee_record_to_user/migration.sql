-- AlterTable
ALTER TABLE "EmployeeRecord" ADD COLUMN     "userId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeRecord_userId_key" ON "EmployeeRecord"("userId");

-- AddForeignKey
ALTER TABLE "EmployeeRecord" ADD CONSTRAINT "EmployeeRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

