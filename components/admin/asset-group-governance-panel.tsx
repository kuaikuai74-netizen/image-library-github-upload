"use client";

import { ChevronDown, ChevronLeft, ChevronRight, Download } from "lucide-react";
import { useState } from "react";
import type { AdminAssetGroupCoverageResult } from "@/lib/admin/asset-group-governance";

type AssetGroupGovernancePanelProps = {
  coverage: AdminAssetGroupCoverageResult;
};

const issueOptions = [
  { value: "incomplete", label: "覆盖不完整" },
  { value: "failed", label: "存在失败素材" },
  { value: "empty", label: "无有效素材" },
];

function missingText(items: string[]) {
  return items.length ? items.join("、") : "无";
}

function queryString(filters: AdminAssetGroupCoverageResult["filters"], changes: Record<string, string>) {
  const params = new URLSearchParams();
  const next = { ...filters, ...changes };
  if (next.search) params.set("governanceSearch", next.search);
  if (next.categoryId) params.set("governanceCategoryId", next.categoryId);
  if (next.missingCountry) params.set("governanceMissingCountry", next.missingCountry);
  if (next.missingAssetType) params.set("governanceMissingAssetType", next.missingAssetType);
  if (next.issue) params.set("governanceIssue", next.issue);
  if (next.page && next.page !== "1") params.set("governancePage", next.page);
  if (next.pageSize && next.pageSize !== "10") params.set("governancePageSize", next.pageSize);
  return params.toString();
}

export function AssetGroupGovernancePanel({ coverage }: AssetGroupGovernancePanelProps) {
  const [openIds, setOpenIds] = useState<Set<string>>(() => new Set());
  const exportQuery = queryString(coverage.filters, { page: "1" });

  function toggle(productId: string) {
    setOpenIds((current) => {
      const next = new Set(current);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
  }

  return (
    <div className="admin-governance-module">
      <form className="admin-governance-filters" method="GET" action="/admin#governance">
        <input type="hidden" name="governancePage" value="1" />
        <label><span>SPU/名称</span><input name="governanceSearch" defaultValue={coverage.filters.search} placeholder="搜索素材库" /></label>
        <label><span>品类</span><select name="governanceCategoryId" defaultValue={coverage.filters.categoryId}><option value="">全部品类</option>{coverage.options.categories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</select></label>
        <label><span>缺少国家</span><select name="governanceMissingCountry" defaultValue={coverage.filters.missingCountry}><option value="">不限国家</option>{coverage.options.countries.map((country) => <option value={country.code} key={country.code}>{country.name}</option>)}</select></label>
        <label><span>缺少类型</span><select name="governanceMissingAssetType" defaultValue={coverage.filters.missingAssetType}><option value="">不限类型</option>{coverage.options.assetTypes.map((assetType) => <option value={assetType} key={assetType}>{assetType}</option>)}</select></label>
        <label><span>问题</span><select name="governanceIssue" defaultValue={coverage.filters.issue}><option value="">全部</option>{issueOptions.map((issue) => <option value={issue.value} key={issue.value}>{issue.label}</option>)}</select></label>
        <label><span>每页</span><select name="governancePageSize" defaultValue={coverage.filters.pageSize}><option value="10">10</option><option value="20">20</option><option value="50">50</option></select></label>
        <button className="admin-primary-button" type="submit">筛选</button>
        <a className="admin-secondary-button" href={`/api/admin/asset-group-governance/export.csv${exportQuery ? `?${exportQuery}` : ""}`}><Download aria-hidden="true" />导出 CSV</a>
      </form>
      <div className="admin-governance-summary">共 {coverage.total} 个素材库，第 {coverage.page} / {coverage.totalPages} 页</div>
      <div className="admin-governance-list">
        {coverage.items.length ? coverage.items.map((product) => {
          const open = openIds.has(product.id);
          return <article key={product.id}><button className="admin-governance-head" type="button" onClick={() => toggle(product.id)} aria-expanded={open}>{open ? <ChevronDown aria-hidden="true" /> : <ChevronRight aria-hidden="true" />}<div><strong>{product.spu}</strong><small>{product.category} · {product.name}</small></div><span>{product.assetCount} 张</span><em>国家 {product.countryCoverage} · 类型 {product.assetTypeCoverage}</em></button>{open && <div className="admin-governance-detail"><dl><div><dt>素材组</dt><dd>{product.activeGroupCount}/{product.groupCount}</dd></div><div><dt>失败素材</dt><dd>{product.failedAssetCount}</dd></div><div><dt>缺少国家</dt><dd>{missingText(product.missingCountries)}</dd></div><div><dt>缺少类型</dt><dd>{missingText(product.missingAssetTypes)}</dd></div><div><dt>最后更新</dt><dd>{product.updatedAt}</dd></div></dl><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>渠道</th><th>国家</th><th>图片类型</th><th>素材数</th><th>失败</th><th>更新时间</th></tr></thead><tbody>{product.groups.map((group) => <tr key={group.id}><td>{group.channel}</td><td>{group.country}</td><td>{group.assetType}</td><td>{group.assetCount}</td><td>{group.failedAssetCount}</td><td>{group.updatedAt}</td></tr>)}</tbody></table></div></div>}</article>;
        }) : <div className="admin-empty">暂无符合条件的素材组数据。</div>}
      </div>
      {coverage.totalPages > 1 && <nav className="admin-governance-pagination" aria-label="素材组治理分页"><a aria-disabled={coverage.page <= 1} href={coverage.page <= 1 ? "#governance" : `/admin?${queryString(coverage.filters, { page: String(coverage.page - 1) })}#governance`}><ChevronLeft aria-hidden="true" />上一页</a><a aria-disabled={coverage.page >= coverage.totalPages} href={coverage.page >= coverage.totalPages ? "#governance" : `/admin?${queryString(coverage.filters, { page: String(coverage.page + 1) })}#governance`}>下一页<ChevronRight aria-hidden="true" /></a></nav>}
    </div>
  );
}
