CREATE TYPE "DownloadBatchType" AS ENUM ('ASSETS', 'PRODUCTS');
CREATE TYPE "DownloadBatchStatus" AS ENUM ('PREPARED', 'DOWNLOADED', 'PARTIAL', 'FAILED');
CREATE TYPE "DownloadBatchItemStatus" AS ENUM ('READY', 'DOWNLOADED', 'FAILED');

CREATE TABLE "DownloadBatch" (
  "id" TEXT NOT NULL,
  "actorId" TEXT,
  "type" "DownloadBatchType" NOT NULL,
  "status" "DownloadBatchStatus" NOT NULL DEFAULT 'PREPARED',
  "requestedCount" INTEGER NOT NULL DEFAULT 0,
  "readyCount" INTEGER NOT NULL DEFAULT 0,
  "failedCount" INTEGER NOT NULL DEFAULT 0,
  "zipFilename" VARCHAR(180) NOT NULL,
  "scope" JSONB,
  "ipAddress" VARCHAR(80),
  "userAgent" TEXT,
  "preparedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "downloadedAt" TIMESTAMP(3),
  CONSTRAINT "DownloadBatch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DownloadBatchItem" (
  "id" TEXT NOT NULL,
  "batchId" TEXT NOT NULL,
  "assetId" TEXT,
  "status" "DownloadBatchItemStatus" NOT NULL DEFAULT 'READY',
  "filename" TEXT,
  "archivePath" TEXT,
  "errorCode" TEXT,
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DownloadBatchItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DownloadBatch_actorId_preparedAt_idx" ON "DownloadBatch"("actorId", "preparedAt");
CREATE INDEX "DownloadBatch_status_preparedAt_idx" ON "DownloadBatch"("status", "preparedAt");
CREATE INDEX "DownloadBatch_type_preparedAt_idx" ON "DownloadBatch"("type", "preparedAt");
CREATE INDEX "DownloadBatchItem_batchId_status_idx" ON "DownloadBatchItem"("batchId", "status");
CREATE INDEX "DownloadBatchItem_assetId_idx" ON "DownloadBatchItem"("assetId");

ALTER TABLE "DownloadBatch" ADD CONSTRAINT "DownloadBatch_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DownloadBatchItem" ADD CONSTRAINT "DownloadBatchItem_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "DownloadBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DownloadBatchItem" ADD CONSTRAINT "DownloadBatchItem_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
