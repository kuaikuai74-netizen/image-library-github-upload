"use client";

import { useRouter } from "next/navigation";
import { ChannelNav } from "@/components/library/channel-nav";
import { LibraryHeader } from "@/components/library/library-header";
import { OnlineMessageWorkspace } from "@/components/messages/online-message-workspace";
import type { LibraryUser } from "@/lib/auth/roles";
import type { VisibleAnnouncement } from "@/lib/content/repository";
import type { ChannelListItem } from "@/lib/library/contracts";
import type { OnlineMessageItem } from "@/lib/messages/repository";

type MessagePageShellProps = {
  currentUser: LibraryUser;
  roleLabel: string;
  canUpload: boolean;
  canAdmin: boolean;
  announcements: VisibleAnnouncement[];
  channels: ChannelListItem[];
  documentCount: number;
  messages: OnlineMessageItem[];
};

export function MessagePageShell({ currentUser, roleLabel, canUpload, canAdmin, announcements, channels, documentCount, messages }: MessagePageShellProps) {
  const router = useRouter();

  function openLibrary(query = "") {
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    const serialized = params.toString();
    router.push(serialized ? `/?${serialized}` : "/");
  }

  return (
    <div className="library-app">
      <LibraryHeader query="" onQueryChange={openLibrary} onUpload={() => router.push("/upload")} currentUser={currentUser} roleLabel={roleLabel} canUpload={canUpload} canAdmin={canAdmin} announcements={announcements} />
      <div className="library-body">
        <ChannelNav channels={channels} activeChannel="" documentCount={documentCount} activeSection="messages" onChange={(channelId) => router.push(`/?channelId=${encodeURIComponent(channelId)}`)} />
        <main className="messages-page"><OnlineMessageWorkspace initialMessages={messages} /></main>
      </div>
    </div>
  );
}
