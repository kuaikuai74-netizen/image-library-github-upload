import { Download, TrendingDown, TrendingUp } from "lucide-react";
import type { AdminOperationsReport } from "@/lib/admin/operations-report";

type OperationsReportPanelProps = {
  report: AdminOperationsReport;
};

function queryString(filters: AdminOperationsReport["filters"]) {
  const params = new URLSearchParams();
  if (filters.from) params.set("reportFrom", filters.from);
  if (filters.to) params.set("reportTo", filters.to);
  return params.toString();
}

function formatBytes(bytes: number) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / (1024 ** index)).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function maxTrendValue(report: AdminOperationsReport) {
  return Math.max(1, ...report.trends.flatMap((row) => [row.assetsCreated, row.assetFailures, row.uploadBatches, row.downloadBatches]));
}

function maxRankingValue(items: Array<{ count: number }>) {
  return Math.max(1, ...items.map((item) => item.count));
}

export function OperationsReportPanel({ report }: OperationsReportPanelProps) {
  const exportQuery = queryString(report.filters);
  const trendMax = maxTrendValue(report);
  const categoryMax = maxRankingValue(report.rankings.categories);
  const channelMax = maxRankingValue(report.rankings.channels);
  const userMax = maxRankingValue(report.rankings.downloadUsers);

  return (
    <div className="admin-report-module">
      <form className="admin-report-filters" method="GET" action="/admin#reports">
        <label><span>开始日期</span><input type="date" name="reportFrom" defaultValue={report.filters.from} /></label>
        <label><span>结束日期</span><input type="date" name="reportTo" defaultValue={report.filters.to} /></label>
        <button className="admin-primary-button" type="submit">生成报表</button>
        <a className="admin-secondary-button" href={`/api/admin/operations-report/export.csv${exportQuery ? `?${exportQuery}` : ""}`}><Download aria-hidden="true" />导出 CSV</a>
      </form>

      <div className="admin-report-metrics">
        <article><TrendingUp aria-hidden="true" /><span>新增素材</span><strong>{report.totals.assetsCreated}</strong><small>失败文件 {report.totals.assetFailures} · 失败率 {report.totals.assetFailureRate}%</small></article>
        <article><TrendingUp aria-hidden="true" /><span>上传批次</span><strong>{report.totals.uploadBatches}</strong><small>异常批次 {report.totals.uploadFailures} · 异常率 {report.totals.uploadFailureRate}%</small></article>
        <article><Download aria-hidden="true" /><span>下载批次</span><strong>{report.totals.downloadBatches}</strong><small>下载素材 {report.totals.downloadedAssets}</small></article>
        <article><TrendingDown aria-hidden="true" /><span>下载失败项</span><strong>{report.totals.downloadFailures}</strong><small>失败率 {report.totals.downloadFailureRate}%</small></article>
      </div>

      <div className="admin-report-chart" aria-label="运营趋势">
        {report.trends.map((row) => (
          <article key={row.date}>
            <time>{row.date.slice(5)}</time>
            <div><span style={{ width: `${(row.assetsCreated / trendMax) * 100}%` }} /></div>
            <div><span className="upload" style={{ width: `${(row.uploadBatches / trendMax) * 100}%` }} /></div>
            <div><span className="download" style={{ width: `${(row.downloadBatches / trendMax) * 100}%` }} /></div>
            <strong>{row.assetsCreated} 新增 · {row.uploadBatches} 上传 · {row.downloadBatches} 下载</strong>
          </article>
        ))}
      </div>

      <div className="admin-report-grid">
        <article className="admin-panel"><h3>新增品类 TOP</h3>{report.rankings.categories.length ? report.rankings.categories.map((item) => <div className="admin-report-rank" key={item.name}><span>{item.name}</span><strong>{item.count}</strong><i><b style={{ width: `${(item.count / categoryMax) * 100}%` }} /></i><small>{formatBytes(item.bytes)}</small></div>) : <div className="admin-empty compact">暂无新增素材数据。</div>}</article>
        <article className="admin-panel"><h3>新增渠道 TOP</h3>{report.rankings.channels.length ? report.rankings.channels.map((item) => <div className="admin-report-rank" key={item.name}><span>{item.name}</span><strong>{item.count}</strong><i><b style={{ width: `${(item.count / channelMax) * 100}%` }} /></i><small>{formatBytes(item.bytes)}</small></div>) : <div className="admin-empty compact">暂无渠道数据。</div>}</article>
        <article className="admin-panel"><h3>下载用户 TOP</h3>{report.rankings.downloadUsers.length ? report.rankings.downloadUsers.map((item) => <div className="admin-report-rank" key={item.name}><span>{item.name}</span><strong>{item.count}</strong><i><b style={{ width: `${(item.count / userMax) * 100}%` }} /></i><small>{item.bytes} 个素材</small></div>) : <div className="admin-empty compact">暂无下载数据。</div>}</article>
      </div>
    </div>
  );
}
