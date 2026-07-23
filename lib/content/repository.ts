import { prisma } from "@/lib/prisma";
import type { LibraryUser, UserRole } from "@/lib/auth/roles";
import type { Prisma } from "@prisma/client";

function announcementRoleVisibilityFilter(role: UserRole): Prisma.AnnouncementWhereInput {
  return { OR: [{ visibilityRoles: { isEmpty: true } }, { visibilityRoles: { has: role } }] };
}

function documentRoleVisibilityFilter(role: UserRole): Prisma.DocumentPageWhereInput {
  return { OR: [{ visibilityRoles: { isEmpty: true } }, { visibilityRoles: { has: role } }] };
}

function activeAnnouncementTimeFilter(now: Date): Prisma.AnnouncementWhereInput {
  return { OR: [{ startsAt: null }, { startsAt: { lte: now } }], AND: [{ OR: [{ endsAt: null }, { endsAt: { gte: now } }] }] };
}

function compactDateTime(value: Date | null) {
  return value ? value.toLocaleString("zh-CN", { hour12: false }) : "-";
}

export async function getVisibleAnnouncements(user: LibraryUser) {
  const now = new Date();
  const announcements = await prisma.announcement.findMany({
    where: { AND: [{ status: "PUBLISHED" }, announcementRoleVisibilityFilter(user.role), activeAnnouncementTimeFilter(now)] },
    include: { reads: { where: { userId: user.id }, select: { readAt: true } } },
    orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
    take: 6,
  });

  return announcements.map((announcement) => ({
    id: announcement.id,
    title: announcement.title,
    body: announcement.body,
    type: announcement.type,
    pinned: announcement.pinned,
    startsAt: compactDateTime(announcement.startsAt),
    endsAt: compactDateTime(announcement.endsAt),
    createdAt: compactDateTime(announcement.createdAt),
    read: announcement.reads.length > 0,
  }));
}

export async function getVisibleDocumentPages(user: LibraryUser) {
  const documents = await prisma.documentPage.findMany({
    where: { AND: [{ status: "PUBLISHED" }, documentRoleVisibilityFilter(user.role)] },
    orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { createdAt: "desc" }],
  });

  return documents.map((document) => ({
    id: document.id,
    slug: document.slug,
    title: document.title,
    body: document.body,
    category: document.category,
    sortOrder: document.sortOrder,
    updatedAt: compactDateTime(document.updatedAt),
  }));
}

export type VisibleAnnouncement = Awaited<ReturnType<typeof getVisibleAnnouncements>>[number];
export type VisibleDocumentPage = Awaited<ReturnType<typeof getVisibleDocumentPages>>[number];
