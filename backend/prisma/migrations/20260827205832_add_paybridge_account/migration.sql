-- CreateTable
CREATE TABLE "PayBridgeAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "bankName" TEXT,
    "accountNameEnc" TEXT,
    "accountNumberEnc" TEXT,
    "accountNumberLast4" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayBridgeAccount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PayBridgeAccount_userId_key" ON "PayBridgeAccount"("userId");

-- AddForeignKey
ALTER TABLE "PayBridgeAccount" ADD CONSTRAINT "PayBridgeAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
