"use client";

import { Edit3, LoaderCircle, RotateCcwKey, Save, UserPlus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useState } from "react";
import { uiLabel, userStatusLabels } from "@/lib/admin/ui-labels";
import { roleLabels, userRoles, userStatuses, type UserRole, type UserStatus } from "@/lib/auth/roles";
import type { ApiFailure, ApiSuccess } from "@/lib/library/contracts";

type AdminUser = {
  id: string;
  name: string;
  email: string;
  username: string;
  role: UserRole;
  roleLabel: string;
  status: UserStatus;
  uploadedAssets: number;
  auditLogs: number;
  createdAt: string;
};

type UserManagementPanelProps = {
  users: AdminUser[];
};

type Mode = "create" | "edit" | "password";

const emptyForm = { name: "", email: "", username: "", password: "", role: "VIEWER" as UserRole, status: "ACTIVE" as UserStatus };

export function UserManagementPanel({ users }: UserManagementPanelProps) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode | null>(null);
  const [activeUser, setActiveUser] = useState<AdminUser | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  function openCreate() {
    setActiveUser(null);
    setForm(emptyForm);
    setError("");
    setMode("create");
  }

  function openEdit(user: AdminUser) {
    setActiveUser(user);
    setForm({ name: user.name, email: user.email, username: user.username, password: "", role: user.role, status: user.status });
    setError("");
    setMode("edit");
  }

  function openPassword(user: AdminUser) {
    setActiveUser(user);
    setForm({ ...emptyForm, password: "" });
    setError("");
    setMode("password");
  }

  function close() {
    if (submitting) return;
    setMode(null);
    setActiveUser(null);
    setForm(emptyForm);
    setError("");
  }

  async function requestJson<T>(url: string, init: RequestInit) {
    const response = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...(init.headers ?? {}) } });
    const body = await response.json() as ApiSuccess<T> | ApiFailure;
    if (!response.ok || "error" in body) throw new Error("error" in body ? body.error.message : "操作失败。");
    return body.data;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!mode) return;
    setSubmitting(true);
    setError("");
    try {
      if (mode === "create") {
        await requestJson("/api/admin/users", { method: "POST", body: JSON.stringify({ name: form.name, email: form.email, username: form.username, password: form.password, role: form.role }) });
      } else if (mode === "edit" && activeUser) {
        await requestJson(`/api/admin/users/${activeUser.id}`, { method: "PATCH", body: JSON.stringify({ name: form.name, email: form.email, username: form.username, role: form.role, status: form.status }) });
      } else if (mode === "password" && activeUser) {
        await requestJson(`/api/admin/users/${activeUser.id}/reset-password`, { method: "POST", body: JSON.stringify({ password: form.password }) });
      }
      close();
      router.refresh();
    } catch (actionError: unknown) {
      setError(actionError instanceof Error ? actionError.message : "操作失败。");
    } finally {
      setSubmitting(false);
    }
  }

  const title = mode === "create" ? "新建用户" : mode === "edit" ? "编辑用户" : "重置密码";

  return (
    <>
      <div className="admin-section-heading"><div><p>用户</p><h2 id="admin-users-title">用户与权限</h2></div><button className="admin-primary-button" type="button" onClick={openCreate}><UserPlus aria-hidden="true" />新建用户</button></div>
      <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>用户</th><th>用户名</th><th>角色</th><th>状态</th><th>上传</th><th>操作</th><th>创建时间</th><th>管理</th></tr></thead><tbody>{users.map((user) => <tr key={user.id}><td><strong>{user.name}</strong><small>{user.email}</small></td><td>{user.username}</td><td>{user.roleLabel}</td><td><span className={user.status === "ACTIVE" ? "admin-status success" : "admin-status"}>{uiLabel(userStatusLabels, user.status)}</span></td><td>{user.uploadedAssets}</td><td>{user.auditLogs}</td><td>{user.createdAt}</td><td><div className="admin-row-actions"><button type="button" onClick={() => openEdit(user)}><Edit3 aria-hidden="true" />编辑</button><button type="button" onClick={() => openPassword(user)}><RotateCcwKey aria-hidden="true" />密码</button></div></td></tr>)}</tbody></table></div>
      {mode && <div className="admin-dialog-backdrop" role="presentation"><form className="admin-dialog" onSubmit={submit} aria-labelledby="user-dialog-title"><header><div><p>用户</p><h2 id="user-dialog-title">{title}</h2>{activeUser && <small>{activeUser.name} · {activeUser.email}</small>}</div><button type="button" onClick={close} aria-label="关闭"><X aria-hidden="true" /></button></header>{mode !== "password" && <><label><span>姓名</span><input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required maxLength={80} /></label><label><span>邮箱</span><input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required maxLength={160} /></label><label><span>用户名</span><input value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} required minLength={3} maxLength={80} pattern="[a-zA-Z0-9._-]+" /></label><label><span>角色</span><select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value as UserRole })}>{userRoles.map((role) => <option value={role} key={role}>{roleLabels[role]}</option>)}</select></label>{mode === "edit" && <label><span>状态</span><select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as UserStatus })}>{userStatuses.map((status) => <option value={status} key={status}>{uiLabel(userStatusLabels, status)}</option>)}</select></label>}</>}{mode !== "edit" && <label><span>{mode === "create" ? "初始密码" : "新密码"}</span><input type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} required minLength={8} maxLength={128} /></label>}{error && <p className="admin-dialog-error" role="alert">{error}</p>}<footer><button type="button" onClick={close} disabled={submitting}>取消</button><button className="primary" type="submit" disabled={submitting}>{submitting ? <LoaderCircle aria-hidden="true" /> : <Save aria-hidden="true" />}{mode === "create" ? "创建用户" : "保存"}</button></footer></form></div>}
    </>
  );
}
