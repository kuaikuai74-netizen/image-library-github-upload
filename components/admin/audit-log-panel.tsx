"use client";

import { ChevronDown, ChevronLeft, ChevronRight, Download } from "lucide-react";
import { useState } from "react";
import { auditActionLabels, auditObjectTypeLabels, uiLabel } from "@/lib/admin/ui-labels";
import type { AdminAuditLogResult } from "@/lib/admin/audit-log-repository";

type AuditLogPanelProps = {
  auditLogs: AdminAuditLogResult;
};

function queryString(filters: AdminAuditLogResult["filters"], changes: Record<string, string>) {
  const params = new URLSearchParams();
  const next = { ...filters, ...changes };
  if (next.action) params.set("auditAction", next.action);
  if (next.actor) params.set("auditActor", next.actor);
  if (next.objectType) params.set("auditObjectType", next.objectType);
  if (next.objectId) params.set("auditObjectId", next.objectId);
  if (next.from) params.set("auditFrom", next.from);
  if (next.to) params.set("auditTo", next.to);
  if (next.page && next.page !== "1") params.set("auditPage", next.page);
  if (next.pageSize && next.pageSize !== "15") params.set("auditPageSize", next.pageSize);
  return params.toString();
}

export function AuditLogPanel({ auditLogs }: AuditLogPanelProps) {
  const [openIds, setOpenIds] = useState<Set<string>>(() => new Set());
  const exportQuery = queryString(auditLogs.filters, { page: "1" });

  function toggle(logId: string) {
    setOpenIds((current) => {
      const next = new Set(current);
      if (next.has(logId)) next.delete(logId);
      else next.add(logId);
      return next;
    });
  }

  return (
    <div className="admin-audit-module">
      <form className="admin-audit-filters" method="GET" action="/admin#audit">
        <input type="hidden" name="auditPage" value="1" />
        <label><span>操作</span><select name="auditAction" defaultValue={auditLogs.filters.action}><option value="">全部操作</option>{auditLogs.options.actions.map((action) => <option value={action} key={action}>{uiLabel(auditActionLabels, action)}</option>)}</select></label>
        <label><span>操作者</span><input name="auditActor" defaultValue={auditLogs.filters.actor} placeholder="姓名或邮箱" /></label>
        <label><span>对象类型</span><select name="auditObjectType" defaultValue={auditLogs.filters.objectType}><option value="">全部对象</option>{auditLogs.options.objectTypes.map((objectType) => <option value={objectType} key={objectType}>{uiLabel(auditObjectTypeLabels, objectType)}</option>)}</select></label>
        <label><span>对象 ID</span><input name="auditObjectId" defaultValue={auditLogs.filters.objectId} placeholder="输入对象 ID" /></label>
        <label><span>开始日期</span><input type="date" name="auditFrom" defaultValue={auditLogs.filters.from} /></label>
        <label><span>结束日期</span><input type="date" name="auditTo" defaultValue={auditLogs.filters.to} /></label>
        <label><span>每页</span><select name="auditPageSize" defaultValue={auditLogs.filters.pageSize}><option value="15">15</option><option value="30">30</option><option value="50">50</option></select></label>
        <button className="admin-primary-button" type="submit">筛选</button>
        <a className="admin-secondary-button" href={`/api/admin/audit-logs/export.csv${exportQuery ? `?${exportQuery}` : ""}`}><Download aria-hidden="true" />导出 CSV</a>
      </form>

      <div className="admin-audit-summary">共 {auditLogs.total} 条审计日志，第 {auditLogs.page} / {auditLogs.totalPages} 页</div>
      <div className="admin-audit-list">
        {auditLogs.items.length ? auditLogs.items.map((log) => {
          const open = openIds.has(log.id);
          return <article key={log.id}><button className="admin-audit-head" type="button" onClick={() => toggle(log.id)} aria-expanded={open}>{open ? <ChevronDown aria-hidden="true" /> : <ChevronRight aria-hidden="true" />}<div><strong>{uiLabel(auditActionLabels, log.action)}</strong><small>{log.actor} · {log.email} · {log.createdAt}</small></div><span>{uiLabel(auditObjectTypeLabels, log.objectType)}</span><em>{log.objectId}</em></button>{open && <div className="admin-audit-detail"><dl><div><dt>日志 ID</dt><dd>{log.id}</dd></div><div><dt>对象</dt><dd>{uiLabel(auditObjectTypeLabels, log.objectType)} · {log.objectId}</dd></div><div><dt>素材</dt><dd>{log.asset ? `${log.asset.spu} · ${log.asset.filename}` : "-"}</dd></div><div><dt>品类/渠道</dt><dd>{log.asset ? `${log.asset.category} · ${log.asset.channel}` : "-"}</dd></div></dl><pre>{log.details}</pre></div>}</article>;
        }) : <div className="admin-empty">暂无符合条件的审计日志。</div>}
      </div>

      {auditLogs.totalPages > 1 && <nav className="admin-audit-pagination" aria-label="审计日志分页"><a aria-disabled={auditLogs.page <= 1} href={auditLogs.page <= 1 ? "#audit" : `/admin?${queryString(auditLogs.filters, { page: String(auditLogs.page - 1) })}#audit`}><ChevronLeft aria-hidden="true" />上一页</a><a aria-disabled={auditLogs.page >= auditLogs.totalPages} href={auditLogs.page >= auditLogs.totalPages ? "#audit" : `/admin?${queryString(auditLogs.filters, { page: String(auditLogs.page + 1) })}#audit`}>下一页<ChevronRight aria-hidden="true" /></a></nav>}
    </div>
  );
}
