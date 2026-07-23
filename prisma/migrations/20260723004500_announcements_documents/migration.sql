ALTER TYPE "AuditAction" ADD VALUE 'ANNOUNCEMENT_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'ANNOUNCEMENT_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE 'DOCUMENT_CREATED';
ALTER TYPE "AuditAction" ADD VALUE 'DOCUMENT_UPDATED';

CREATE TYPE "AnnouncementType" AS ENUM ('INFO', 'MAINTENANCE', 'POLICY', 'ALERT');
CREATE TYPE "ContentStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

CREATE TABLE "Announcement" (
  "id" TEXT NOT NULL,
  "title" VARCHAR(160) NOT NULL,
  "body" TEXT NOT NULL,
  "type" "AnnouncementType" NOT NULL DEFAULT 'INFO',
  "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
  "visibilityRoles" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "pinned" BOOLEAN NOT NULL DEFAULT false,
  "startsAt" TIMESTAMP(3),
  "endsAt" TIMESTAMP(3),
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AnnouncementRead" (
  "id" TEXT NOT NULL,
  "announcementId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AnnouncementRead_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DocumentPage" (
  "id" TEXT NOT NULL,
  "slug" VARCHAR(120) NOT NULL,
  "title" VARCHAR(160) NOT NULL,
  "body" TEXT NOT NULL,
  "category" VARCHAR(80) NOT NULL,
  "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
  "visibilityRoles" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DocumentPage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AnnouncementRead_announcementId_userId_key" ON "AnnouncementRead"("announcementId", "userId");
CREATE INDEX "Announcement_status_pinned_createdAt_idx" ON "Announcement"("status", "pinned", "createdAt");
CREATE INDEX "Announcement_createdById_createdAt_idx" ON "Announcement"("createdById", "createdAt");
CREATE INDEX "AnnouncementRead_userId_readAt_idx" ON "AnnouncementRead"("userId", "readAt");
CREATE UNIQUE INDEX "DocumentPage_slug_key" ON "DocumentPage"("slug");
CREATE INDEX "DocumentPage_status_category_sortOrder_idx" ON "DocumentPage"("status", "category", "sortOrder");
CREATE INDEX "DocumentPage_createdById_createdAt_idx" ON "DocumentPage"("createdById", "createdAt");

ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AnnouncementRead" ADD CONSTRAINT "AnnouncementRead_announcementId_fkey" FOREIGN KEY ("announcementId") REFERENCES "Announcement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AnnouncementRead" ADD CONSTRAINT "AnnouncementRead_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DocumentPage" ADD CONSTRAINT "DocumentPage_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
