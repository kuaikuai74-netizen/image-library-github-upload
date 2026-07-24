import { Prisma } from "@prisma/client";
import { success } from "@/lib/api/response";
import { routeFailure } from "@/lib/api/route-helpers";
import { documentCreateSchema } from "@/lib/admin/content-schema";
import { requireSuperAdmin } from "@/lib/auth/server";
import { UploadError } from "@/lib/assets/upload-errors";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    await requireSuperAdmin();
    const documents = await prisma.documentPage.findMany({
      include: { createdBy: { select: { name: true, email: true } } },
      orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { createdAt: "desc" }],
      take: 80,
    });
    return success(documents);
  } catch (error) {
    return routeFailure(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireSuperAdmin();
    const input = documentCreateSchema.parse(await request.json());
    const document = await prisma.$transaction(async (transaction) => {
      const created = await transaction.documentPage.create({
        data: { ...input, createdById: actor.id },
        include: { createdBy: { select: { name: true, email: true } } },
      });
      await transaction.auditLog.create({ data: { actorId: actor.id, action: "DOCUMENT_CREATED", objectType: "DocumentPage", objectId: created.id, details: { title: created.title, slug: created.slug, status: created.status } } });
      return created;
    });
    return success(document, 201);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return routeFailure(new UploadError("DOCUMENT_SLUG_EXISTS", "文档 slug 已存在。", 409));
    }
    return routeFailure(error);
  }
}
