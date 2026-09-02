CREATE TABLE "OnlineMessage" (
  "id" TEXT NOT NULL,
  "authorId" TEXT NOT NULL,
  "body" VARCHAR(2000) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OnlineMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OnlineMessage_authorId_createdAt_idx" ON "OnlineMessage"("authorId", "createdAt");

ALTER TABLE "OnlineMessage" ADD CONSTRAINT "OnlineMessage_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
