"use client";

import { CheckCircle2, Database, HardDrive, LoaderCircle, RefreshCw, ShieldAlert, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { checkStatusLabels, storageProbeStatusLabels, uiLabel } from "@/lib/admin/ui-labels";
import type { AdminSystemStatus } from "@/lib/admin/system-status";
import type { ApiFailure, ApiSuccess } from "@/lib/library/contracts";

type SystemStatusPanelProps = {
  initialStatus: AdminSystemStatus;
};

function formatBytes(bytes: number) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / (1024 ** index)).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function statusClass(status: string) {
  if (status === "PASS") return "admin-status success";
  if (status === "FAIL") return "admin-status danger";
  return "admin-status";
}

function statusIcon(status: string) {
  if (status === "PASS") return <CheckCircle2 aria-hidden="true" />;
  if (status === "FAIL") return <ShieldAlert aria-hidden="true" />;
  return <TriangleAlert aria-hidden="true" />;
}

async function parseResponse<T>(response: Response) {
  const body = await response.json() as ApiSuccess<T> | ApiFailure;
  if (!response.ok || "error" in body) throw new Error("error" in body ? body.error.message : "请求失败。");
  return body.data;
}

export function SystemStatusPanel({ initialStatus }: SystemStatusPanelProps) {
  const [status, setStatus] = useState(initialStatus);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function refresh() {
    setBusy(true);
    setMessage("");
    try {
      setStatus(await parseResponse<AdminSystemStatus>(await fetch("/api/admin/system/status", { cache: "no-store" })));
      setMessage("系统自检已刷新。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "刷新失败。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-system-module">
      <div className="admin-system-summary">
        <article><span>{statusIcon(status.overall)}</span><div><strong><span className={statusClass(status.overall)}>{uiLabel(checkStatusLabels, status.overall)}</span></strong><small>最后检查：{status.checkedAt}</small></div></article>
        <article><Database aria-hidden="true" /><div><strong>{status.database.connected ? "数据库正常" : "数据库异常"}</strong><small>{status.database.target}</small></div></article>
        <article><HardDrive aria-hidden="true" /><div><strong>{uiLabel(storageProbeStatusLabels, status.storage?.probeStatus ?? "UNKNOWN")}</strong><small>{status.storage ? `${status.storage.driver} · ${formatBytes(status.storage.storageBytes)}` : "存储状态不可用"}</small></div></article>
      </div>

      <div className="admin-system-actions">
        <p>{status.app.name} v{status.app.version} · Next {status.app.nextVersion} · Prisma {status.app.prismaVersion} · {status.app.nodeEnv}</p>
        <button className="admin-secondary-button" type="button" onClick={refresh} disabled={busy}>{busy ? <LoaderCircle aria-hidden="true" /> : <RefreshCw aria-hidden="true" />}刷新自检</button>
      </div>
      {message && <p className="admin-storage-message" role="status">{message}</p>}

      <div className="admin-system-grid">
        <article className="admin-panel"><h3>数据库与迁移</h3><dl className="admin-system-facts"><div><dt>活跃用户</dt><dd>{status.database.activeUsers}</dd></div><div><dt>超级管理员</dt><dd>{status.database.activeSuperAdmins}</dd></div><div><dt>迁移进度</dt><dd>{status.database.appliedMigrations}/{status.database.migrationFolders}</dd></div><div><dt>最后迁移</dt><dd>{status.database.lastAppliedMigration ? status.database.lastAppliedMigration.name : "-"}</dd></div></dl>{status.database.pendingMigrations.length > 0 && <p className="admin-system-warning">待应用迁移：{status.database.pendingMigrations.join("、")}</p>}</article>
        <article className="admin-panel"><h3>存储与文件</h3><dl className="admin-system-facts"><div><dt>驱动</dt><dd>{status.storage?.driver ?? "-"}</dd></div><div><dt>根目录</dt><dd>{status.storage?.root ?? "-"}</dd></div><div><dt>缺失 Key</dt><dd>{status.storage?.missingKeys ?? "-"}</dd></div><div><dt>清理候选</dt><dd>{status.storage?.cleanupCandidates ?? "-"}</dd></div></dl></article>
      </div>

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead><tr><th>状态</th><th>检查项</th><th>说明</th></tr></thead>
          <tbody>{status.checks.map((item) => <tr key={item.id}><td><span className={statusClass(item.status)}>{uiLabel(checkStatusLabels, item.status)}</span></td><td>{item.label}</td><td>{item.message}</td></tr>)}</tbody>
        </table>
      </div>
    </div>
  );
}
