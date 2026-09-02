import { prisma } from "@/lib/prisma";

export type OnlineMessageItem = {
  id: string;
  body: string;
  createdAt: string;
};

export type AdminOnlineMessageItem = OnlineMessageItem & {
  authorName: string;
  authorEmail: string;
};

function formatDateTime(value: Date) {
  return value.toLocaleString("zh-CN", { hour12: false });
}

export async function listOnlineMessages(authorId: string): Promise<OnlineMessageItem[]> {
  const messages = await prisma.onlineMessage.findMany({
    where: { authorId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return messages.map((message) => ({ id: message.id, body: message.body, createdAt: formatDateTime(message.createdAt) }));
}

export async function createOnlineMessage(authorId: string, body: string): Promise<OnlineMessageItem> {
  const message = await prisma.onlineMessage.create({ data: { authorId, body } });
  return { id: message.id, body: message.body, createdAt: formatDateTime(message.createdAt) };
}

export async function listAdminOnlineMessages(): Promise<AdminOnlineMessageItem[]> {
  const messages = await prisma.onlineMessage.findMany({
    include: { author: { select: { name: true, email: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return messages.map((message) => ({
    id: message.id,
    body: message.body,
    createdAt: formatDateTime(message.createdAt),
    authorName: message.author.name,
    authorEmail: message.author.email,
  }));
}
