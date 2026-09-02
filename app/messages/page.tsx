import { redirect } from "next/navigation";
import { MessagePageShell } from "@/components/messages/message-page-shell";
import { hasAssetPermission } from "@/lib/auth/permissions";
import { roleLabels } from "@/lib/auth/roles";
import { getCurrentUser } from "@/lib/auth/server";
import { getVisibleAnnouncements, getVisibleDocumentPages } from "@/lib/content/repository";
import { listChannels } from "@/lib/library/repository";
import { listOnlineMessages } from "@/lib/messages/repository";

export default async function MessagesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?callbackUrl=/messages");
  const [messages, announcements, documents, channels] = await Promise.all([listOnlineMessages(user.id), getVisibleAnnouncements(user), getVisibleDocumentPages(user), listChannels()]);
  return <MessagePageShell currentUser={user} roleLabel={roleLabels[user.role]} canUpload={hasAssetPermission(user.role, "upload", { userId: user.id })} canAdmin={user.role === "SUPER_ADMIN"} announcements={announcements} channels={channels} documentCount={documents.length} messages={messages} />;
}
