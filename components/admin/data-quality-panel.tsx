"use client";

import { AlertTriangle, ChevronLeft, ChevronRight, Download, ExternalLink, Info, ShieldAlert } from "lucide-react";
import { qualitySeverityLabels, uiLabel } from "@/lib/admin/ui-labels";
import type { AdminDataQualityResult } from "@/lib/admin/data-quality";

type DataQualityPanelProps = {
  quality: AdminDataQualityResult;
};

function queryString(filters: AdminDataQualityResult["filters"], changes: Record<string, string>) {
  const params = new URLSearchParams();
  const next = { ...filters, ...changes };
  if (next.type) params.set("qualityType", next.type);
  if (next.severity) params.set("qualitySeverity", next.severity);
  if (next.search) params.set("qualitySearch", next.search);
  if (next.page && next.page !== "1") params.set("qualityPage", next.page);
  if (next.pageSize && next.pageSize !== "12") params.set("qualityPageSize", next.pageSize);
  return params.toString();
}

function severityClass(severity: string) {
  if (severity === "ERROR") return "admin-status danger";
  if (severity === "WARN") return "admin-status";
  return "admin-status success";
}

export function DataQualityPanel({ quality }: DataQualityPanelProps) {
  const exportQuery = queryString(quality.filters, { page: "1" });

  return (
    <div className="admin-quality-module">
      <div className="admin-quality-summary">
        <article><ShieldAlert aria-hidden="true" /><span>错误</span><strong>{quality.summary.errors}</strong></article>
        <article><AlertTriangle aria-hidden="true" /><span>警告</span><strong>{quality.summary.warnings}</strong></article>
        <article><Info aria-hidden="true" /><span>提示</span><strong>{quality.summary.info}</strong></article>
        <article><Info aria-hidden="true" /><span>问题总数</span><strong>{quality.summary.total}</strong></article>
      </div>

      <form className="admin-quality-filters" method="GET" action="/admin#quality">
        <input type="hidden" name="qualityPage" value="1" />
        <label><span>类型</span><select name="qualityType" defaultValue={quality.filters.type}><option value="">全部类型</option>{quality.options.types.map((type) => <option value={type.value} key={type.value}>{type.label}</option>)}</select></label>
        <label><span>级别</span><select name="qualitySeverity" defaultValue={quality.filters.severity}><option value="">全部级别</option>{quality.options.severities.map((severity) => <option value={severity} key={severity}>{uiLabel(qualitySeverityLabels, severity)}</option>)}</select></label>
        <label><span>搜索</span><input name="qualitySearch" defaultValue={quality.filters.search} placeholder="SPU、文件名或问题" /></label>
        <label><span>每页</span><select name="qualityPageSize" defaultValue={quality.filters.pageSize}><option value="12">12</option><option value="24">24</option><option value="50">50</option></select></label>
        <button className="admin-primary-button" type="submit">筛选</button>
        <a className="admin-secondary-button" href={`/api/admin/data-quality/export.csv${exportQuery ? `?${exportQuery}` : ""}`}><Download aria-hidden="true" />导出 CSV</a>
      </form>

      <div className="admin-quality-list">
        {quality.items.length ? quality.items.map((issue) => (
          <article key={issue.id}>
            <div><span className={severityClass(issue.severity)}>{uiLabel(qualitySeverityLabels, issue.severity)}</span><strong>{issue.typeLabel}</strong><small>{issue.updatedAt}</small></div>
            <div><strong>{issue.spu}</strong><small>{issue.category} · {issue.channel} · {issue.country} · {issue.assetType}</small><small>{issue.filename}</small></div>
            <p>{issue.message}</p>
            <a href={issue.libraryUrl}><ExternalLink aria-hidden="true" />查看素材库</a>
          </article>
        )) : <div className="admin-empty">当前筛选条件下暂无质量问题。</div>}
      </div>

      {quality.totalPages > 1 && <nav className="admin-quality-pagination" aria-label="数据质量分页"><a aria-disabled={quality.page <= 1} href={quality.page <= 1 ? "#quality" : `/admin?${queryString(quality.filters, { page: String(quality.page - 1) })}#quality`}><ChevronLeft aria-hidden="true" />上一页</a><a aria-disabled={quality.page >= quality.totalPages} href={quality.page >= quality.totalPages ? "#quality" : `/admin?${queryString(quality.filters, { page: String(quality.page + 1) })}#quality`}>下一页<ChevronRight aria-hidden="true" /></a></nav>}
      <div className="admin-quality-summaryline">共 {quality.total} 条符合条件的问题，第 {quality.page} / {quality.totalPages} 页。</div>
    </div>
  );
}
