"use client";

import { Edit3, FilePlus2, LoaderCircle, Save, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useState } from "react";
import { contentStatuses } from "@/lib/admin/content-schema";
import { roleLabels, userRoles, type UserRole } from "@/lib/auth/roles";
import type { ApiFailure, ApiSuccess } from "@/lib/library/contracts";

type DocumentStatus = (typeof contentStatuses)[number];

type DocumentItem = {
  id: string;
  slug: string;
  title: string;
  body: string;
  category: string;
  status: DocumentStatus;
  visibilityRoles: UserRole[];
  sortOrder: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

type DocumentManagementPanelProps = {
  documents: DocumentItem[];
};

const statusLabels: Record<DocumentStatus, string> = { DRAFT: "草稿", PUBLISHED: "已发布", ARCHIVED: "已归档" };
const emptyForm = { slug: "", title: "", body: "", category: "用户手册", status: "DRAFT" as DocumentStatus, visibilityRoles: [] as UserRole[], sortOrder: 0 };

function roleText(roles: UserRole[]) {
  return roles.length ? roles.map((role) => roleLabels[role]).join("、") : "全员可见";
}

function slugFromTitle(title: string) {
  return title.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120);
}

export function DocumentManagementPanel({ documents }: DocumentManagementPanelProps) {
  const router = useRouter();
  const [active, setActive] = useState<DocumentItem | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  function openCreate() {
    setActive(null);
    setForm(emptyForm);
    setError("");
    setOpen(true);
  }

  function openEdit(item: DocumentItem) {
    setActive(item);
    setForm({ slug: item.slug, title: item.title, body: item.body, category: item.category, status: item.status, visibilityRoles: item.visibilityRoles, sortOrder: item.sortOrder });
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
      if (active) await requestJson(`/api/admin/documents/${active.id}`, { method: "PATCH", body: JSON.stringify(form) });
      else await requestJson("/api/admin/documents", { method: "POST", body: JSON.stringify(form) });
      close();
      router.refresh();
    } catch (actionError: unknown) {
      setError(actionError instanceof Error ? actionError.message : "操作失败。");
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteDocument(item: DocumentItem) {
    if (!window.confirm(`确认删除文档“${item.title}”？删除后不可恢复。`)) return;
    setDeletingId(item.id);
    setError("");
    try {
      await requestJson(`/api/admin/documents/${item.id}`, { method: "DELETE" });
      router.refresh();
    } catch (actionError: unknown) {
      setError(actionError instanceof Error ? actionError.message : "删除失败。");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <>
      <div className="admin-section-heading"><div><p>文档</p><h2 id="admin-documents-title">文档中心</h2></div><button className="admin-primary-button" type="button" onClick={openCreate}><FilePlus2 aria-hidden="true" />新建文档</button></div>
      <div className="admin-content-list admin-document-list">{documents.length ? documents.map((item) => <article key={item.id}><div className="admin-content-main"><div className="admin-content-title"><strong>{item.title}</strong><span>{item.category}</span></div><p>{item.body}</p><small>/{item.slug} · {roleText(item.visibilityRoles)} · 排序 {item.sortOrder}</small><small>{item.createdBy} · 更新 {item.updatedAt}</small></div><div className="admin-content-actions"><span className={item.status === "PUBLISHED" ? "admin-status success" : "admin-status"}>{statusLabels[item.status]}</span><button type="button" onClick={() => openEdit(item)}><Edit3 aria-hidden="true" />编辑</button><button className="danger" type="button" onClick={() => { void deleteDocument(item); }} disabled={deletingId === item.id}>{deletingId === item.id ? <LoaderCircle aria-hidden="true" /> : <Trash2 aria-hidden="true" />}删除</button></div></article>) : <div className="admin-empty compact">暂无文档。</div>}</div>
      {error && !open && <p className="admin-dialog-error" role="alert">{error}</p>}
      {open && <div className="admin-dialog-backdrop" role="presentation"><form className="admin-dialog admin-dialog-wide" onSubmit={submit} aria-labelledby="document-dialog-title"><header><div><p>文档</p><h2 id="document-dialog-title">{active ? "编辑文档" : "新建文档"}</h2>{active && <small>{active.createdBy} · {active.createdAt}</small>}</div><button type="button" onClick={close} aria-label="关闭"><X aria-hidden="true" /></button></header><label><span>标题</span><input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value, slug: active ? form.slug : slugFromTitle(event.target.value) })} required maxLength={160} /></label><div className="admin-dialog-columns"><label><span>文档路径</span><input value={form.slug} onChange={(event) => setForm({ ...form, slug: event.target.value })} required minLength={2} maxLength={120} pattern="[a-z0-9]+(-[a-z0-9]+)*" /></label><label><span>分类</span><input value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} required maxLength={80} /></label></div><label><span>正文</span><textarea value={form.body} onChange={(event) => setForm({ ...form, body: event.target.value })} required maxLength={20000} /></label><div className="admin-dialog-columns"><label><span>状态</span><select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as DocumentStatus })}>{contentStatuses.map((status) => <option value={status} key={status}>{statusLabels[status]}</option>)}</select></label><label><span>排序</span><input type="number" min={0} max={10000} value={form.sortOrder} onChange={(event) => setForm({ ...form, sortOrder: Number(event.target.value) })} /></label></div><fieldset className="admin-role-field"><legend>可见角色</legend><small>不勾选时默认全员可见。</small><div>{userRoles.map((role) => <label key={role}><input type="checkbox" checked={form.visibilityRoles.includes(role)} onChange={() => toggleRole(role)} />{roleLabels[role]}</label>)}</div></fieldset>{error && <p className="admin-dialog-error" role="alert">{error}</p>}<footer><button type="button" onClick={close} disabled={submitting}>取消</button><button className="primary" type="submit" disabled={submitting}>{submitting ? <LoaderCircle aria-hidden="true" /> : <Save aria-hidden="true" />}{active ? "保存" : "创建"}</button></footer></form></div>}
    </>
  );
}
