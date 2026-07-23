"use client";

import { Bell, BookOpen, CheckCircle2, Images, Info, LogOut, ScrollText, Search, Shield, TriangleAlert, Upload, UserRound, Wrench, X } from "lucide-react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { LibraryUser } from "@/lib/auth/roles";
import type { VisibleAnnouncement } from "@/lib/content/repository";
import type { ApiFailure, ApiSuccess } from "@/lib/library/contracts";

type LibraryHeaderProps = {
  query: string;
  onQueryChange: (value: string) => void;
  onUpload: () => void;
  currentUser: LibraryUser;
  roleLabel: string;
  canUpload: boolean;
  canAdmin: boolean;
  announcements: VisibleAnnouncement[];
};

const typeLabels: Record<VisibleAnnouncement["type"], string> = { INFO: "通知", MAINTENANCE: "维护", POLICY: "规范", ALERT: "警示" };
const typeIcons = { INFO: Info, MAINTENANCE: Wrench, POLICY: ScrollText, ALERT: TriangleAlert } satisfies Record<VisibleAnnouncement["type"], typeof Info>;

export function LibraryHeader({ query, onQueryChange, onUpload, currentUser, roleLabel, canUpload, canAdmin, announcements }: LibraryHeaderProps) {
  const queryTimeoutRef = useRef<number | undefined>(undefined);
  const [searchValue, setSearchValue] = useState(query);
  const [announcementItems, setAnnouncementItems] = useState(announcements);
  const [announcementOpen, setAnnouncementOpen] = useState(false);
  const unreadCount = useMemo(() => announcementItems.filter((item) => !item.read).length, [announcementItems]);

  useEffect(() => {
    return () => window.clearTimeout(queryTimeoutRef.current);
  }, []);

  function scheduleQueryChange(value: string) {
    setSearchValue(value);
    window.clearTimeout(queryTimeoutRef.current);
    queryTimeoutRef.current = window.setTimeout(() => onQueryChange(value), 450);
  }

  function commitQueryChange(value: string) {
    setSearchValue(value);
    window.clearTimeout(queryTimeoutRef.current);
    onQueryChange(value);
  }

  function clearSearch() {
    setSearchValue("");
    window.clearTimeout(queryTimeoutRef.current);
    onQueryChange("");
  }

  async function markAnnouncementRead(announcementId: string) {
    setAnnouncementItems((current) => current.map((item) => item.id === announcementId ? { ...item, read: true } : item));
    const response = await fetch(`/api/announcements/${announcementId}/read`, { method: "POST" });
    const body = await response.json() as ApiSuccess<unknown> | ApiFailure;
    if (!response.ok || "error" in body) {
      setAnnouncementItems((current) => current.map((item) => item.id === announcementId ? { ...item, read: false } : item));
    }
  }

  return (
    <>
    <header className="topbar">
      <div className="brand" aria-label="跨境电商视觉资产">
        <span className="brand-mark"><Images aria-hidden="true" /></span>
        <span>
          <strong>跨境电商视觉资产</strong>
          <small>集中管理跨境渠道图片素材</small>
        </span>
      </div>

      <label className="global-search">
        <Search aria-hidden="true" />
        <span className="sr-only">全局搜索</span>
        <input
          type="search"
          value={searchValue}
          onChange={(event) => scheduleQueryChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") commitQueryChange(event.currentTarget.value);
          }}
          placeholder="搜索 SPU、文件名、SKU 或品类"
        />
        {searchValue && <button className="search-clear-button" type="button" onClick={clearSearch} aria-label="清空搜索" title="清空搜索"><X aria-hidden="true" /></button>}
      </label>

      <div className="header-actions">
        <button className="icon-button announcement-entry" type="button" onClick={() => setAnnouncementOpen(true)} aria-label={`公告，${unreadCount} 条未读`} title="公告">
          <Bell aria-hidden="true" />
          <span>公告</span>
          {unreadCount > 0 && <em>{unreadCount > 99 ? "99+" : unreadCount}</em>}
        </button>
        <Link className="icon-button" href="/docs" aria-label="使用文档" title="使用文档"><BookOpen aria-hidden="true" /><span>文档</span></Link>
        {canAdmin && <Link className="icon-button" href="/admin" aria-label="管理后台" title="管理后台"><Shield aria-hidden="true" /><span>后台</span></Link>}
        {canUpload && <button className="icon-button upload-icon-button" type="button" onClick={onUpload} aria-label="上传素材" title="上传素材">
          <Upload aria-hidden="true" />
          <span>上传</span>
        </button>}
        <button className="avatar" type="button" aria-label={`当前用户：${currentUser.name}`}>
          <UserRound aria-hidden="true" />
          <span><strong>{currentUser.name}</strong><small>{roleLabel}</small></span>
        </button>
        <button className="sign-out" type="button" onClick={() => signOut({ callbackUrl: "/login" })} aria-label="退出登录"><LogOut aria-hidden="true" /></button>
      </div>
    </header>

      {announcementOpen && <div className="announcement-modal-backdrop" role="presentation">
        <section className="announcement-modal" role="dialog" aria-modal="true" aria-labelledby="announcement-modal-title">
          <header>
            <div>
              <p>公告</p>
              <h2 id="announcement-modal-title">公告</h2>
            </div>
            <button type="button" onClick={() => setAnnouncementOpen(false)} aria-label="关闭公告"><X aria-hidden="true" /></button>
          </header>
          <div className="announcement-modal-list">
            {announcementItems.length ? announcementItems.map((item) => {
              const TypeIcon = typeIcons[item.type];
              return (
                <article key={item.id} className={item.read ? "is-read" : undefined}>
                  <span className={`announcement-icon ${item.type.toLowerCase()}`} aria-label={typeLabels[item.type]}><TypeIcon aria-hidden="true" /></span>
                  <div>
                    <div className="announcement-title"><strong>{item.title}</strong>{item.pinned && <span>置顶</span>}<span>{typeLabels[item.type]}</span>{!item.read && <i>未读</i>}</div>
                    <p>{item.body}</p>
                    <small>{item.createdAt} · 有效期 {item.startsAt} 至 {item.endsAt}</small>
                  </div>
                  <button type="button" disabled={item.read} onClick={() => { void markAnnouncementRead(item.id); }}><CheckCircle2 aria-hidden="true" />{item.read ? "已读" : "标记已读"}</button>
                </article>
              );
            }) : <div className="announcement-modal-empty">暂无公告。</div>}
          </div>
        </section>
      </div>}
    </>
  );
}
