import { Prisma } from "@prisma/client";
import { success } from "@/lib/api/response";
import { routeFailure } from "@/lib/api/route-helpers";
import { documentUpdateSchema } from "@/lib/admin/content-schema";
import { requireSuperAdmin } from "@/lib/auth/server";
import { UploadError } from "@/lib/assets/upload-errors";
import { assetIdSchema } from "@/lib/assets/upload-schema";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ documentId: string }> };

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const actor = await requireSuperAdmin();
    const { documentId } = await params;
    const parsedDocumentId = assetIdSchema.parse(documentId);
    const input = documentUpdateSchema.parse(await request.json());
    const existing = await prisma.documentPage.findUnique({ where: { id: parsedDocumentId }, select: { id: true } });
    if (!existing) throw new UploadError("DOCUMENT_NOT_FOUND", "文档不存在。", 404);

    const document = await prisma.$transaction(async (transaction) => {
      const updated = await transaction.documentPage.update({
        where: { id: parsedDocumentId },
        data: input,
        include: { createdBy: { select: { name: true, email: true } } },
      });
      await transaction.auditLog.create({ data: { actorId: actor.id, action: "DOCUMENT_UPDATED", objectType: "DocumentPage", objectId: updated.id, details: { changes: input } } });
      return updated;
    });
    return success(document);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return routeFailure(new UploadError("DOCUMENT_SLUG_EXISTS", "文档 slug 已存在。", 409));
    }
    return routeFailure(error);
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  try {
    const actor = await requireSuperAdmin();
    const { documentId } = await params;
    const parsedDocumentId = assetIdSchema.parse(documentId);
    const existing = await prisma.documentPage.findUnique({ where: { id: parsedDocumentId }, select: { id: true, title: true, slug: true, status: true } });
    if (!existing) throw new UploadError("DOCUMENT_NOT_FOUND", "文档不存在。", 404);

    await prisma.$transaction(async (transaction) => {
      await transaction.documentPage.delete({ where: { id: parsedDocumentId } });
      await transaction.auditLog.create({ data: { actorId: actor.id, action: "DOCUMENT_UPDATED", objectType: "DocumentPage", objectId: parsedDocumentId, details: { operation: "delete", title: existing.title, slug: existing.slug, status: existing.status } } });
    });

    return success({ id: parsedDocumentId });
  } catch (error) {
    return routeFailure(error);
  }
}
