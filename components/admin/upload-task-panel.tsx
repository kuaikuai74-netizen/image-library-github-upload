"use client";

import { ChevronDown, ChevronLeft, ChevronRight, Download, ExternalLink, Upload } from "lucide-react";
import { useState } from "react";
import { assetStatusLabels, uiLabel, uploadStatusLabels } from "@/lib/admin/ui-labels";
import type { AdminUploadTaskResult } from "@/lib/admin/upload-task-repository";

type UploadTaskPanelProps = {
  uploadTasks: AdminUploadTaskResult;
};

function formatBytes(bytes: number) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / (1024 ** index)).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function queryString(filters: AdminUploadTaskResult["filters"], changes: Record<string, string>) {
  const params = new URLSearchParams();
  const next = { ...filters, ...changes };
  if (next.status) params.set("uploadStatus", next.status);
  if (next.user) params.set("uploadUser", next.user);
  if (next.spu) params.set("uploadSpu", next.spu);
  if (next.onlyFailed) params.set("uploadOnlyFailed", next.onlyFailed);
  if (next.from) params.set("uploadFrom", next.from);
  if (next.to) params.set("uploadTo", next.to);
  if (next.page && next.page !== "1") params.set("uploadPage", next.page);
  if (next.pageSize && next.pageSize !== "10") params.set("uploadPageSize", next.pageSize);
  return params.toString();
}

function statusClass(status: string) {
  if (status === "COMPLETED" || status === "ACTIVE") return "admin-status success";
  if (status === "FAILED") return "admin-status danger";
  return "admin-status";
}

export function UploadTaskPanel({ uploadTasks }: UploadTaskPanelProps) {
  const [openIds, setOpenIds] = useState<Set<string>>(() => new Set());
  const exportQuery = queryString(uploadTasks.filters, { page: "1" });

  function toggle(uploadId: string) {
    setOpenIds((current) => {
      const next = new Set(current);
      if (next.has(uploadId)) next.delete(uploadId);
      else next.add(uploadId);
      return next;
    });
  }

  return (
    <div className="admin-upload-module">
      <form className="admin-upload-filters" method="GET" action="/admin#uploads">
        <input type="hidden" name="uploadPage" value="1" />
        <label><span>状态</span><select name="uploadStatus" defaultValue={uploadTasks.filters.status}><option value="">全部状态</option>{uploadTasks.options.statuses.map((status) => <option value={status} key={status}>{uiLabel(uploadStatusLabels, status)}</option>)}</select></label>
        <label><span>用户</span><input name="uploadUser" defaultValue={uploadTasks.filters.user} placeholder="姓名或邮箱" /></label>
        <label><span>SPU</span><input name="uploadSpu" defaultValue={uploadTasks.filters.spu} placeholder="输入 SPU" /></label>
        <label><span>失败项</span><select name="uploadOnlyFailed" defaultValue={uploadTasks.filters.onlyFailed}><option value="">全部任务</option><option value="1">只看失败</option></select></label>
        <label><span>开始日期</span><input type="date" name="uploadFrom" defaultValue={uploadTasks.filters.from} /></label>
        <label><span>结束日期</span><input type="date" name="uploadTo" defaultValue={uploadTasks.filters.to} /></label>
        <label><span>每页</span><select name="uploadPageSize" defaultValue={uploadTasks.filters.pageSize}><option value="10">10</option><option value="20">20</option><option value="50">50</option></select></label>
        <button className="admin-primary-button" type="submit">筛选</button>
        <a className="admin-secondary-button" href={`/api/admin/upload-tasks/export.csv${exportQuery ? `?${exportQuery}` : ""}`}><Download aria-hidden="true" />导出 CSV</a>
      </form>
      <div className="admin-upload-summary">共 {uploadTasks.total} 个上传批次，第 {uploadTasks.page} / {uploadTasks.totalPages} 页</div>
      <div className="admin-upload-tasks">
      {uploadTasks.items.length ? uploadTasks.items.map((upload) => {
        const open = openIds.has(upload.id);
        return <article key={upload.id}><button className="admin-upload-task-head" type="button" onClick={() => toggle(upload.id)} aria-expanded={open}>{open ? <ChevronDown aria-hidden="true" /> : <ChevronRight aria-hidden="true" />}<div><strong>{upload.spu} · {upload.category}</strong><small>{upload.uploader} · {upload.email} · {upload.createdAt}</small></div><span className={statusClass(upload.status)}>{uiLabel(uploadStatusLabels, upload.status)}</span><em>{upload.activeCount}/{upload.assetCount} 成功 · {upload.failedCount} 失败</em></button>{open && <div className="admin-upload-task-detail"><dl><div><dt>渠道</dt><dd>{upload.channel}</dd></div><div><dt>国家</dt><dd>{upload.countryCode}</dd></div><div><dt>图片类型</dt><dd>{upload.assetType}</dd></div><div><dt>完成时间</dt><dd>{upload.completedAt}</dd></div><div><dt>上传批次</dt><dd>{upload.id}</dd></div><div><dt>素材数</dt><dd>{upload.assetCount}</dd></div></dl><div className="admin-upload-actions"><a href={upload.libraryUrl}><ExternalLink aria-hidden="true" />查看素材库</a><a href={upload.uploadUrl}><Upload aria-hidden="true" />重新上传到该素材组</a></div><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>状态</th><th>文件</th><th>类型</th><th>其他</th><th>排序</th><th>尺寸</th><th>大小</th><th>错误</th></tr></thead><tbody>{upload.assets.map((asset) => <tr key={asset.id}><td><span className={statusClass(asset.status)}>{uiLabel(assetStatusLabels, asset.status)}</span></td><td><strong>{asset.filename}</strong><small>{asset.originalFilename}</small></td><td>{asset.assetType}</td><td>{asset.color}</td><td>{asset.sortOrder}</td><td>{asset.width} x {asset.height}</td><td>{formatBytes(asset.fileSizeBytes)}</td><td><strong>{asset.errorCode}</strong><small>{asset.errorMessage}</small></td></tr>)}</tbody></table></div></div>}</article>;
      }) : <div className="admin-empty">暂无上传任务。</div>}
      </div>
      {uploadTasks.totalPages > 1 && <nav className="admin-upload-pagination" aria-label="上传任务分页"><a aria-disabled={uploadTasks.page <= 1} href={uploadTasks.page <= 1 ? "#uploads" : `/admin?${queryString(uploadTasks.filters, { page: String(uploadTasks.page - 1) })}#uploads`}><ChevronLeft aria-hidden="true" />上一页</a><a aria-disabled={uploadTasks.page >= uploadTasks.totalPages} href={uploadTasks.page >= uploadTasks.totalPages ? "#uploads" : `/admin?${queryString(uploadTasks.filters, { page: String(uploadTasks.page + 1) })}#uploads`}>下一页<ChevronRight aria-hidden="true" /></a></nav>}
    </div>
  );
}
