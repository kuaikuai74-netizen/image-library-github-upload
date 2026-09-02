"use client";

import { BookOpen, GitBranch, MessageSquareText, ShoppingBag } from "lucide-react";
import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import type { ChannelListItem } from "@/lib/library/contracts";

const channelIcons = {
  amazon: ShoppingBag,
  multi: GitBranch,
};

type ChannelNavProps = {
  channels: ChannelListItem[];
  activeChannel: string;
  documentCount: number;
  activeSection?: "documents" | "messages";
  onChange: (channel: string) => void;
};

export function ChannelNav({ channels, activeChannel, documentCount, activeSection, onChange }: ChannelNavProps) {
  return (
    <aside className="channel-rail">
      <nav className="channel-list" aria-label="渠道导航">
        {channels.map((channel) => {
          const Icon = channelIcons[channel.name === "Amazon" ? "amazon" : "multi"];
          const active = activeChannel === channel.id;
          return (
            <button
              className={active ? "channel-item is-active" : "channel-item"}
              key={channel.id}
              type="button"
              aria-current={active ? "page" : undefined}
              onClick={() => onChange(channel.id)}
            >
              <Icon aria-hidden="true" />
              <span>{channel.name}</span>
              <small>{channel.assetCount}</small>
            </button>
          );
        })}
      </nav>
      <nav className="channel-documents" aria-label="文档导航">
        <Link className={activeSection === "documents" ? "channel-item is-active" : "channel-item"} href="/docs"><BookOpen aria-hidden="true" /><span>文档</span><small>{documentCount}</small></Link>
        <Link className={activeSection === "messages" ? "channel-item is-active" : "channel-item"} href="/messages"><MessageSquareText aria-hidden="true" /><span>在线留言</span></Link>
      </nav>
      <div className="rail-note">
        <ThemeToggle compact />
        <strong>数据库浏览</strong>
        <p>渠道、品类和素材查询均来自受保护的分页接口，暂不连接文件存储或 NAS。</p>
      </div>
    </aside>
  );
}
