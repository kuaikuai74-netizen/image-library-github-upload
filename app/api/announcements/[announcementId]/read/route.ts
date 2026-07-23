import type { Prisma } from "@prisma/client";
import { success } from "@/lib/api/response";
import { routeFailure } from "@/lib/api/route-helpers";
import { requireCurrentUser } from "@/lib/auth/server";
import { UploadError } from "@/lib/assets/upload-errors";
import { assetIdSchema } from "@/lib/assets/upload-schema";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ announcementId: string }> };

function roleVisibilityFilter(role: string): Prisma.AnnouncementWhereInput {
  return { OR: [{ visibilityRoles: { isEmpty: true } }, { visibilityRoles: { has: role } }] };
}

export async function POST(_request: Request, { params }: RouteContext) {
  try {
    const user = await requireCurrentUser();
    const { announcementId } = await params;
    const parsedAnnouncementId = assetIdSchema.parse(announcementId);
    const announcement = await prisma.announcement.findFirst({
      where: { AND: [{ id: parsedAnnouncementId, status: "PUBLISHED" }, roleVisibilityFilter(user.role)] },
      select: { id: true },
    });
    if (!announcement) throw new UploadError("ANNOUNCEMENT_NOT_FOUND", "公告不存在或不可见。", 404);

    const read = await prisma.announcementRead.upsert({
      where: { announcementId_userId: { announcementId: parsedAnnouncementId, userId: user.id } },
      create: { announcementId: parsedAnnouncementId, userId: user.id },
      update: { readAt: new Date() },
      select: { announcementId: true, readAt: true },
    });
    return success(read);
  } catch (error) {
    return routeFailure(error);
  }
}
