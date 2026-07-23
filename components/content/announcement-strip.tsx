"use client";

import { Bell, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import type { ApiFailure, ApiSuccess } from "@/lib/library/contracts";

type AnnouncementItem = {
  id: string;
  title: string;
  body: string;
  type: "INFO" | "MAINTENANCE" | "POLICY" | "ALERT";
  pinned: boolean;
  startsAt: string;
  endsAt: string;
  createdAt: string;
  read: boolean;
};

type AnnouncementStripProps = {
  announcements: AnnouncementItem[];
};

const typeLabels: Record<AnnouncementItem["type"], string> = { INFO: "通知", MAINTENANCE: "维护", POLICY: "规范", ALERT: "警示" };

export function AnnouncementStrip({ announcements }: AnnouncementStripProps) {
  const [items, setItems] = useState(announcements);

  async function markRead(announcementId: string) {
    setItems((current) => current.map((item) => item.id === announcementId ? { ...item, read: true } : item));
    const response = await fetch(`/api/announcements/${announcementId}/read`, { method: "POST" });
    const body = await response.json() as ApiSuccess<unknown> | ApiFailure;
    if (!response.ok || "error" in body) {
      setItems((current) => current.map((item) => item.id === announcementId ? { ...item, read: false } : item));
    }
  }

  if (!items.length) return null;

  return (
    <section className="announcement-strip" aria-labelledby="announcements-title">
      <div className="announcement-heading"><Bell aria-hidden="true" /><div><p>Announcements</p><h2 id="announcements-title">最新公告</h2></div></div>
      <div className="announcement-list">
        {items.map((item) => <article key={item.id} className={item.read ? "is-read" : undefined}><div><div className="announcement-title"><strong>{item.title}</strong>{item.pinned && <span>置顶</span>}<span>{typeLabels[item.type]}</span></div><p>{item.body}</p><small>{item.createdAt} · 有效期 {item.startsAt} 至 {item.endsAt}</small></div><button type="button" disabled={item.read} onClick={() => { void markRead(item.id); }}><CheckCircle2 aria-hidden="true" />{item.read ? "已读" : "标记已读"}</button></article>)}
      </div>
    </section>
  );
}
