import { failure, success } from "@/lib/api/response";
import { routeFailure } from "@/lib/api/route-helpers";
import { requireCurrentUser } from "@/lib/auth/server";
import { onlineMessageCreateSchema } from "@/lib/messages/message-schema";
import { createOnlineMessage, listOnlineMessages } from "@/lib/messages/repository";

export async function GET() {
  try {
    const user = await requireCurrentUser();
    return success(await listOnlineMessages(user.id));
  } catch (error) {
    return routeFailure(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireCurrentUser();
    const parsed = onlineMessageCreateSchema.safeParse(await request.json());
    if (!parsed.success) return failure("INVALID_MESSAGE", parsed.error.issues[0]?.message ?? "留言内容无效。", 400);
    return success(await createOnlineMessage(user.id, parsed.data.body), 201);
  } catch (error) {
    return routeFailure(error);
  }
}
