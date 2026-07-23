"use client";

import { Edit3, LoaderCircle, Megaphone, Save, X } from "lucide-react";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useState } from "react";
import { announcementTypes, contentStatuses } from "@/lib/admin/content-schema";
import { roleLabels, userRoles, type UserRole } from "@/lib/auth/roles";
import type { ApiFailure, ApiSuccess } from "@/lib/library/contracts";

type AnnouncementStatus = (typeof contentStatuses)[number];
type AnnouncementType = (typeof announcementTypes)[number];

type AnnouncementItem = {
  id: string;
  title: string;
  body: string;
  type: AnnouncementType;
  status: AnnouncementStatus;
  visibilityRoles: UserRole[];
  pinned: boolean;
  startsAt: string;
  endsAt: string;
  startsAtInput: string;
  endsAtInput: string;
  readCount: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

type AnnouncementManagementPanelProps = {
  announcements: AnnouncementItem[];
};

const typeLabels: Record<AnnouncementType, string> = { INFO: "通知", MAINTENANCE: "维护", POLICY: "规范", ALERT: "警示" };
const statusLabels: Record<AnnouncementStatus, string> = { DRAFT: "草稿", PUBLISHED: "已发布", ARCHIVED: "已归档" };
const emptyForm = { title: "", body: "", type: "INFO" as AnnouncementType, status: "DRAFT" as AnnouncementStatus, visibilityRoles: [] as UserRole[], pinned: false, startsAt: "", endsAt: "" };

function roleText(roles: UserRole[]) {
  return roles.length ? roles.map((role) => roleLabels[role]).join("、") : "全员可见";
}

export function AnnouncementManagementPanel({ announcements }: AnnouncementManagementPanelProps) {
  const router = useRouter();
  const [active, setActive] = useState<AnnouncementItem | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  function openCreate() {
    setActive(null);
    setForm(emptyForm);
    setError("");
    setOpen(true);
  }

  function openEdit(item: AnnouncementItem) {
    setActive(item);
    setForm({ title: item.title, body: item.body, type: item.type, status: item.status, visibilityRoles: item.visibilityRoles, pinned: item.pinned, startsAt: item.startsAtInput, endsAt: item.endsAtInput });
    setError("");
    setOpen(true);
  }

  function close() {
    if (submitting) return;
    setOpen(false);
    setActive(null);
    setForm(emptyForm);
    setError("");
  }

  function toggleRole(role: UserRole) {
    setForm((current) => ({ ...current, visibilityRoles: current.visibilityRoles.includes(role) ? current.visibilityRoles.filter((item) => item !== role) : [...current.visibilityRoles, role] }));
  }

  async function requestJson<T>(url: string, init: RequestInit) {
    const response = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...(init.headers ?? {}) } });
    const body = await response.json() as ApiSuccess<T> | ApiFailure;
    if (!response.ok || "error" in body) throw new Error("error" in body ? body.error.message : "操作失败。");
    return body.data;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const payload = { ...form, startsAt: form.startsAt || null, endsAt: form.endsAt || null };
      if (active) await requestJson(`/api/admin/announcements/${active.id}`, { method: "PATCH", body: JSON.stringify(payload) });
      else await requestJson("/api/admin/announcements", { method: "POST", body: JSON.stringify(payload) });
      close();
      router.refresh();
    } catch (actionError: unknown) {
      setError(actionError instanceof Error ? actionError.message : "操作失败。");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="admin-section-heading"><div><p>Notice</p><h2 id="admin-announcements-title">公告管理</h2></div><button className="admin-primary-button" type="button" onClick={openCreate}><Megaphone aria-hidden="true" />发布公告</button></div>
      <div className="admin-content-list">{announcements.length ? announcements.map((item) => <article key={item.id}><div className="admin-content-main"><div className="admin-content-title"><strong>{item.title}</strong>{item.pinned && <span>置顶</span>}</div><p>{item.body}</p><small>{typeLabels[item.type]} · {roleText(item.visibilityRoles)} · 已读 {item.readCount} · 更新 {item.updatedAt}</small><small>有效期 {item.startsAt} 至 {item.endsAt}</small></div><div className="admin-content-actions"><span className={item.status === "PUBLISHED" ? "admin-status success" : "admin-status"}>{statusLabels[item.status]}</span><button type="button" onClick={() => openEdit(item)}><Edit3 aria-hidden="true" />编辑</button></div></article>) : <div className="admin-empty compact">暂无公告。</div>}</div>
      {open && <div className="admin-dialog-backdrop" role="presentation"><form className="admin-dialog admin-dialog-wide" onSubmit={submit} aria-labelledby="announcement-dialog-title"><header><div><p>Notice</p><h2 id="announcement-dialog-title">{active ? "编辑公告" : "发布公告"}</h2>{active && <small>{active.createdBy} · {active.createdAt}</small>}</div><button type="button" onClick={close} aria-label="关闭"><X aria-hidden="true" /></button></header><label><span>标题</span><input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required maxLength={160} /></label><label><span>正文</span><textarea value={form.body} onChange={(event) => setForm({ ...form, body: event.target.value })} required maxLength={10000} /></label><div className="admin-dialog-columns"><label><span>类型</span><select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value as AnnouncementType })}>{announcementTypes.map((type) => <option value={type} key={type}>{typeLabels[type]}</option>)}</select></label><label><span>状态</span><select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as AnnouncementStatus })}>{contentStatuses.map((status) => <option value={status} key={status}>{statusLabels[status]}</option>)}</select></label></div><div className="admin-dialog-columns"><label><span>开始时间</span><input type="datetime-local" value={form.startsAt} onChange={(event) => setForm({ ...form, startsAt: event.target.value })} /></label><label><span>结束时间</span><input type="datetime-local" value={form.endsAt} onChange={(event) => setForm({ ...form, endsAt: event.target.value })} /></label></div><label className="admin-checkbox"><input type="checkbox" checked={form.pinned} onChange={(event) => setForm({ ...form, pinned: event.target.checked })} /><span>置顶显示</span></label><fieldset className="admin-role-field"><legend>可见角色</legend><small>不勾选时默认全员可见。</small><div>{userRoles.map((role) => <label key={role}><input type="checkbox" checked={form.visibilityRoles.includes(role)} onChange={() => toggleRole(role)} />{roleLabels[role]}</label>)}</div></fieldset>{error && <p className="admin-dialog-error" role="alert">{error}</p>}<footer><button type="button" onClick={close} disabled={submitting}>取消</button><button className="primary" type="submit" disabled={submitting}>{submitting ? <LoaderCircle aria-hidden="true" /> : <Save aria-hidden="true" />}{active ? "保存" : "发布"}</button></footer></form></div>}
    </>
  );
}
