"use client";

import { ChevronDown, ChevronLeft, ChevronRight, Download } from "lucide-react";
import { useState } from "react";
import { downloadBatchStatusLabels, downloadBatchTypeLabels, downloadItemStatusLabels, uiLabel } from "@/lib/admin/ui-labels";

type DownloadBatch = {
  id: string;
  type: string;
  status: string;
  user: string;
  email: string;
  requestedCount: number;
  readyCount: number;
  failedCount: number;
  zipFilename: string;
  ipAddress: string;
  userAgent: string;
  preparedAt: string;
  downloadedAt: string;
  items: Array<{ id: string; status: string; filename: string; archivePath: string; errorCode: string; spu: string; category: string; channel: string }>;
};

type DownloadBatchPanelProps = {
  batches: DownloadBatch[];
  page: number;
  totalPages: number;
  total: number;
  filters: { page: string; pageSize: string; status: string; type: string; user: string; from: string; to: string };
};

const statusOptions = ["PREPARED", "DOWNLOADED", "PARTIAL", "FAILED"];
const typeOptions = ["ASSETS", "PRODUCTS"];

function queryString(filters: DownloadBatchPanelProps["filters"], changes: Record<string, string>) {
  const params = new URLSearchParams();
  const next = { ...filters, ...changes };
  if (next.status) params.set("downloadStatus", next.status);
  if (next.type) params.set("downloadType", next.type);
  if (next.user) params.set("downloadUser", next.user);
  if (next.from) params.set("downloadFrom", next.from);
  if (next.to) params.set("downloadTo", next.to);
  if (next.page && next.page !== "1") params.set("downloadPage", next.page);
  if (next.pageSize && next.pageSize !== "10") params.set("downloadPageSize", next.pageSize);
  return params.toString();
}

export function DownloadBatchPanel({ batches, page, totalPages, total, filters }: DownloadBatchPanelProps) {
  const [openIds, setOpenIds] = useState<Set<string>>(() => new Set());
  const exportQuery = queryString(filters, { page: "1" });

  function toggle(batchId: string) {
    setOpenIds((current) => {
      const next = new Set(current);
      if (next.has(batchId)) next.delete(batchId);
      else next.add(batchId);
      return next;
    });
  }

  return (
    <div className="admin-download-module">
      <form className="admin-download-filters" method="GET" action="/admin#downloads">
        <input type="hidden" name="downloadPage" value="1" />
        <label><span>状态</span><select name="downloadStatus" defaultValue={filters.status}><option value="">全部状态</option>{statusOptions.map((status) => <option value={status} key={status}>{uiLabel(downloadBatchStatusLabels, status)}</option>)}</select></label>
        <label><span>类型</span><select name="downloadType" defaultValue={filters.type}><option value="">全部类型</option>{typeOptions.map((type) => <option value={type} key={type}>{uiLabel(downloadBatchTypeLabels, type)}</option>)}</select></label>
        <label><span>用户</span><input name="downloadUser" defaultValue={filters.user} placeholder="姓名或邮箱" /></label>
        <label><span>开始日期</span><input type="date" name="downloadFrom" defaultValue={filters.from} /></label>
        <label><span>结束日期</span><input type="date" name="downloadTo" defaultValue={filters.to} /></label>
        <label><span>每页</span><select name="downloadPageSize" defaultValue={filters.pageSize}><option value="10">10</option><option value="20">20</option><option value="50">50</option></select></label>
        <button className="admin-primary-button" type="submit">筛选</button>
        <a className="admin-secondary-button" href={`/api/admin/download-batches/export.csv${exportQuery ? `?${exportQuery}` : ""}`}><Download aria-hidden="true" />导出 CSV</a>
      </form>
      <div className="admin-download-summary">共 {total} 个下载批次，第 {page} / {totalPages} 页</div>
      <div className="admin-download-batches">
        {batches.length ? batches.map((batch) => {
          const open = openIds.has(batch.id);
          return <article key={batch.id}><button className="admin-download-batch-head" type="button" onClick={() => toggle(batch.id)} aria-expanded={open}>{open ? <ChevronDown aria-hidden="true" /> : <ChevronRight aria-hidden="true" />}<div><strong>{uiLabel(downloadBatchTypeLabels, batch.type)} · {batch.zipFilename}</strong><small>{batch.user} · {batch.email} · {batch.downloadedAt}</small></div><span className={batch.status === "DOWNLOADED" ? "admin-status success" : "admin-status"}>{uiLabel(downloadBatchStatusLabels, batch.status)}</span><em>{batch.readyCount}/{batch.requestedCount} 成功</em></button>{open && <div className="admin-download-batch-detail"><dl><div><dt>IP</dt><dd>{batch.ipAddress}</dd></div><div><dt>用户代理</dt><dd>{batch.userAgent}</dd></div><div><dt>准备时间</dt><dd>{batch.preparedAt}</dd></div><div><dt>失败数</dt><dd>{batch.failedCount}</dd></div></dl><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>状态</th><th>文件</th><th>ZIP 路径</th><th>SPU</th><th>品类</th><th>渠道</th><th>错误</th></tr></thead><tbody>{batch.items.map((item) => <tr key={item.id}><td><span className={item.status === "DOWNLOADED" ? "admin-status success" : "admin-status"}>{uiLabel(downloadItemStatusLabels, item.status)}</span></td><td>{item.filename}</td><td>{item.archivePath}</td><td>{item.spu}</td><td>{item.category}</td><td>{item.channel}</td><td>{item.errorCode}</td></tr>)}</tbody></table></div></div>}</article>;
        }) : <div className="admin-empty">暂无 ZIP 下载批次。</div>}
      </div>
      {totalPages > 1 && <nav className="admin-download-pagination" aria-label="下载批次分页"><a aria-disabled={page <= 1} href={page <= 1 ? "#downloads" : `/admin?${queryString(filters, { page: String(page - 1) })}#downloads`}><ChevronLeft aria-hidden="true" />上一页</a><a aria-disabled={page >= totalPages} href={page >= totalPages ? "#downloads" : `/admin?${queryString(filters, { page: String(page + 1) })}#downloads`}>下一页<ChevronRight aria-hidden="true" /></a></nav>}
    </div>
  );
}
