import { success } from "@/lib/api/response";
import { routeFailure } from "@/lib/api/route-helpers";
import { announcementCreateSchema } from "@/lib/admin/content-schema";
import { requireCurrentUser } from "@/lib/auth/server";
import { UploadError } from "@/lib/assets/upload-errors";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const actor = await requireCurrentUser();
    if (actor.role !== "SUPER_ADMIN") throw new UploadError("FORBIDDEN", "无权查看公告。", 403);
    const announcements = await prisma.announcement.findMany({
      include: { createdBy: { select: { name: true, email: true } }, _count: { select: { reads: true } } },
      orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
      take: 50,
    });
    return success(announcements);
  } catch (error) {
    return routeFailure(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireCurrentUser();
    if (actor.role !== "SUPER_ADMIN") throw new UploadError("FORBIDDEN", "无权发布公告。", 403);
    const input = announcementCreateSchema.parse(await request.json());
    const announcement = await prisma.$transaction(async (transaction) => {
      const created = await transaction.announcement.create({
        data: { ...input, createdById: actor.id },
        include: { createdBy: { select: { name: true, email: true } }, _count: { select: { reads: true } } },
      });
      await transaction.auditLog.create({ data: { actorId: actor.id, action: "ANNOUNCEMENT_CREATED", objectType: "Announcement", objectId: created.id, details: { title: created.title, status: created.status } } });
      return created;
    });
    return success(announcement, 201);
  } catch (error) {
    return routeFailure(error);
  }
}
