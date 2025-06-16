-- CreateTable
CREATE TABLE "OcContract" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" JSONB NOT NULL,
    "signerAddress" TEXT,
    "adminSignature" TEXT,
    "userSignature" TEXT,
    "relayUsed" BOOLEAN NOT NULL DEFAULT false,
    "txHash" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OcContract_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OcContract_status_idx" ON "OcContract"("status");

-- CreateIndex
CREATE INDEX "OcContract_signerAddress_idx" ON "OcContract"("signerAddress");

-- CreateIndex
CREATE INDEX "OcContract_createdAt_idx" ON "OcContract"("createdAt"); 