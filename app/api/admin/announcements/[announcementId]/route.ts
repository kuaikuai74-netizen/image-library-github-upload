import { success } from "@/lib/api/response";
import { routeFailure } from "@/lib/api/route-helpers";
import { announcementUpdateSchema } from "@/lib/admin/content-schema";
import { requireCurrentUser } from "@/lib/auth/server";
import { UploadError } from "@/lib/assets/upload-errors";
import { assetIdSchema } from "@/lib/assets/upload-schema";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ announcementId: string }> };

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const actor = await requireCurrentUser();
    if (actor.role !== "SUPER_ADMIN") throw new UploadError("FORBIDDEN", "无权修改公告。", 403);
    const { announcementId } = await params;
    const parsedAnnouncementId = assetIdSchema.parse(announcementId);
    const input = announcementUpdateSchema.parse(await request.json());
    const existing = await prisma.announcement.findUnique({ where: { id: parsedAnnouncementId }, select: { id: true } });
    if (!existing) throw new UploadError("ANNOUNCEMENT_NOT_FOUND", "公告不存在。", 404);

    const announcement = await prisma.$transaction(async (transaction) => {
      const updated = await transaction.announcement.update({
        where: { id: parsedAnnouncementId },
        data: input,
        include: { createdBy: { select: { name: true, email: true } }, _count: { select: { reads: true } } },
      });
      await transaction.auditLog.create({ data: { actorId: actor.id, action: "ANNOUNCEMENT_UPDATED", objectType: "Announcement", objectId: updated.id, details: { changes: input } } });
      return updated;
    });
    return success(announcement);
  } catch (error) {
    return routeFailure(error);
  }
}
