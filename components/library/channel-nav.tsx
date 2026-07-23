"use client";

import { GitBranch, Layers3, ShoppingBag } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import type { ChannelListItem } from "@/lib/library/contracts";

const channelIcons = {
  all: Layers3,
  amazon: ShoppingBag,
  multi: GitBranch,
};

type ChannelNavProps = {
  channels: ChannelListItem[];
  activeChannel: string | "all";
  totalCount: number;
  onChange: (channel: string | "all") => void;
};

export function ChannelNav({ channels, activeChannel, totalCount, onChange }: ChannelNavProps) {
  return (
    <aside className="channel-rail">
      <div className="rail-heading">
        <span>渠道范围</span>
        <small>{totalCount} 张</small>
      </div>
      <nav className="channel-list" aria-label="渠道导航">
        <button className={activeChannel === "all" ? "channel-item is-active" : "channel-item"} type="button" aria-current={activeChannel === "all" ? "page" : undefined} onClick={() => onChange("all")}>
          <Layers3 aria-hidden="true" /><span>全部渠道</span><small>{totalCount}</small>
        </button>
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
      <div className="rail-note">
        <ThemeToggle compact />
        <strong>数据库浏览</strong>
        <p>渠道、品类和素材查询均来自受保护的分页接口，暂不连接文件存储或 NAS。</p>
      </div>
    </aside>
  );
}
