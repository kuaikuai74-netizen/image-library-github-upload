"use client";

import { Activity, HardDrive, LoaderCircle, RefreshCw, ShieldCheck, Trash2, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { cleanupStatusLabels, fileObjectStatusLabels, storageProbeStatusLabels, uiLabel } from "@/lib/admin/ui-labels";
import type { AdminStorageHealth } from "@/lib/admin/storage-health";
import type { ApiFailure, ApiSuccess } from "@/lib/library/contracts";

type StorageHealthPanelProps = {
  initialHealth: AdminStorageHealth;
};

type CleanupResult = {
  requested: number;
  processed: number;
  completed: number;
  failed: number;
  results: Array<{ id: string; status: string; error?: string }>;
};

function formatBytes(bytes: number) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / (1024 ** index)).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function statusClass(status: string) {
  return status === "HEALTHY" || status === "COMPLETED" || status === "NONE" || status === "ACTIVE" ? "admin-status success" : "admin-status";
}

function countTotal(items: Array<{ count: number }>) {
  return items.reduce((total, item) => total + item.count, 0);
}

function percent(count: number, total: number) {
  return total ? Math.max(4, Math.round((count / total) * 100)) : 0;
}

async function parseResponse<T>(response: Response) {
  const body = await response.json() as ApiSuccess<T> | ApiFailure;
  if (!response.ok || "error" in body) throw new Error("error" in body ? body.error.message : "请求失败。");
  return body.data;
}

export function StorageHealthPanel({ initialHealth }: StorageHealthPanelProps) {
  const [health, setHealth] = useState(initialHealth);
  const [busy, setBusy] = useState<"refresh" | "cleanup" | null>(null);
  const [message, setMessage] = useState("");
  const fileStatusTotal = countTotal(health.fileStatusCounts);
  const cleanupStatusTotal = countTotal(health.cleanupStatusCounts);

  async function refresh() {
    setBusy("refresh");
    setMessage("");
    try {
      setHealth(await parseResponse<AdminStorageHealth>(await fetch("/api/admin/storage/health", { cache: "no-store" })));
      setMessage("健康状态已刷新。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "刷新失败。");
    } finally {
      setBusy(null);
    }
  }

  async function cleanup() {
    if (!window.confirm("确认清理待处理文件？只会处理没有有效素材引用的文件对象。")) return;
    setBusy("cleanup");
    setMessage("");
    try {
      const result = await parseResponse<CleanupResult>(await fetch("/api/admin/storage/cleanup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ limit: 20 }) }));
      setHealth(await parseResponse<AdminStorageHealth>(await fetch("/api/admin/storage/health", { cache: "no-store" })));
      setMessage(`清理完成：处理 ${result.processed} 个，成功 ${result.completed} 个，失败 ${result.failed} 个。`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "清理失败。");
    } finally {
      setBusy(null);
    }
  }

  const pendingCount = health.cleanupStatusCounts.find((item) => item.status === "PENDING")?.count ?? 0;

  return (
    <div className="admin-storage-module">
      <div className="admin-storage-summary">
        <article><HardDrive aria-hidden="true" /><span>存储驱动</span><strong>{health.driver}</strong><small>{health.root}</small></article>
        <article><Activity aria-hidden="true" /><span>读写探针</span><strong><span className={statusClass(health.probe.status)}>{uiLabel(storageProbeStatusLabels, health.probe.status)}</span></strong><small>{health.probe.checkedAt}</small></article>
        <article><ShieldCheck aria-hidden="true" /><span>存储占用</span><strong>{formatBytes(health.storageBytes)}</strong><small>有效文件对象合计</small></article>
        <article><TriangleAlert aria-hidden="true" /><span>待清理</span><strong>{pendingCount}</strong><small>{health.pendingActiveReferenceCount} 个仍有活动引用</small></article>
      </div>

      <div className="admin-storage-actions">
        <p>{health.probe.message}</p>
        <div>
          <button className="admin-secondary-button" type="button" onClick={refresh} disabled={busy !== null}>{busy === "refresh" ? <LoaderCircle aria-hidden="true" /> : <RefreshCw aria-hidden="true" />}刷新状态</button>
          <button className="admin-primary-button" type="button" onClick={cleanup} disabled={busy !== null || pendingCount === 0}>{busy === "cleanup" ? <LoaderCircle aria-hidden="true" /> : <Trash2 aria-hidden="true" />}清理待处理文件</button>
        </div>
      </div>
      {message && <p className="admin-storage-message" role="status">{message}</p>}

      <div className="admin-dashboard-grid two">
        <article className="admin-panel"><h3>文件对象状态</h3>{health.fileStatusCounts.map((item) => <div className="admin-bar-row" key={item.status}><span>{uiLabel(fileObjectStatusLabels, item.status)}</span><strong>{item.count}</strong><i><b style={{ width: `${percent(item.count, fileStatusTotal)}%` }} /></i></div>)}</article>
        <article className="admin-panel"><h3>清理状态</h3>{health.cleanupStatusCounts.map((item) => <div className="admin-bar-row" key={item.status}><span>{uiLabel(cleanupStatusLabels, item.status)}</span><strong>{item.count}</strong><i><b style={{ width: `${percent(item.count, cleanupStatusTotal)}%` }} /></i></div>)}</article>
      </div>

      <div className="admin-storage-checks">
        <article><strong>派生图字段</strong><span>缺缩略图 {health.missingDerivatives.thumbnails} · 缺预览图 {health.missingDerivatives.previews} · 原图空记录 {health.missingDerivatives.originalRecords}</span></article>
        <article><strong>存在性抽样</strong><span>抽查 {health.fileExistenceScan.fileObjects} 个文件对象、{health.fileExistenceScan.keys} 个 key，缺失 {health.fileExistenceScan.missingCount} 个。</span></article>
      </div>

      {health.fileExistenceScan.missingKeys.length > 0 && <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>缺失文件对象</th><th>缺失 Key</th></tr></thead><tbody>{health.fileExistenceScan.missingKeys.map((item) => <tr key={`${item.fileObjectId}-${item.key}`}><td>{item.fileObjectId}</td><td>{item.key}</td></tr>)}</tbody></table></div>}

      <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>状态</th><th>示例素材</th><th>大小</th><th>活动引用</th><th>请求时间</th><th>错误</th></tr></thead><tbody>{health.cleanupCandidates.length ? health.cleanupCandidates.map((item) => <tr key={item.id}><td><span className={statusClass(item.cleanupStatus)}>{uiLabel(cleanupStatusLabels, item.cleanupStatus)}</span></td><td><strong>{item.sampleAsset}</strong><small>{item.id}</small></td><td>{formatBytes(item.fileSizeBytes)}</td><td>{item.activeReferences}</td><td>{item.cleanupRequestedAt}</td><td>{item.cleanupError}</td></tr>) : <tr><td colSpan={6}>暂无待清理或清理失败文件。</td></tr>}</tbody></table></div>
    </div>
  );
}
