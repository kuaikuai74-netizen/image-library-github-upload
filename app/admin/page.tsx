import Link from "next/link";
import { redirect } from "next/navigation";
import { Activity, ArrowLeft, BarChart3, Bell, BookOpen, CalendarDays, CheckCircle2, ClipboardCheck, Database, Download, FileText, HardDrive, LayoutDashboard, LockKeyhole, MessageSquareText, ScrollText, Shield, ShieldAlert, Upload, Users } from "lucide-react";
import { AuditLogPanel } from "@/components/admin/audit-log-panel";
import { AssetGroupGovernancePanel } from "@/components/admin/asset-group-governance-panel";
import { DataQualityPanel } from "@/components/admin/data-quality-panel";
import { AnnouncementManagementPanel } from "@/components/admin/announcement-management-panel";
import { DeploymentRunbookPanel } from "@/components/admin/deployment-runbook-panel";
import { DownloadBatchPanel } from "@/components/admin/download-batch-panel";
import { DocumentManagementPanel } from "@/components/admin/document-management-panel";
import { OperationsReportPanel } from "@/components/admin/operations-report-panel";
import { PolicySettingsPanel } from "@/components/admin/policy-settings-panel";
import { StorageHealthPanel } from "@/components/admin/storage-health-panel";
import { SystemStatusPanel } from "@/components/admin/system-status-panel";
import { UploadTaskPanel } from "@/components/admin/upload-task-panel";
import { UserManagementPanel } from "@/components/admin/user-management-panel";
import { OnlineMessagePanel } from "@/components/admin/online-message-panel";
import { listAdminAuditLogs, parseAdminAuditLogFilters } from "@/lib/admin/audit-log-repository";
import { listAdminAssetGroupCoverage, parseAdminAssetGroupGovernanceFilters } from "@/lib/admin/asset-group-governance";
import { listAdminDataQuality, parseAdminDataQualityFilters } from "@/lib/admin/data-quality";
import { listAdminDownloadBatches, parseAdminDownloadBatchFilters } from "@/lib/admin/download-batch-repository";
import { getAdminOperationsReport, parseAdminOperationsReportFilters } from "@/lib/admin/operations-report";
import { getAdminPolicySettings } from "@/lib/admin/policy-settings";
import { listAdminUploadTasks, parseAdminUploadTaskFilters } from "@/lib/admin/upload-task-repository";
import { getAdminStorageHealth } from "@/lib/admin/storage-health";
import { getAdminSystemStatus } from "@/lib/admin/system-status";
import { uiLabel, uploadStatusLabels } from "@/lib/admin/ui-labels";
import { getCurrentUser } from "@/lib/auth/server";
import { getAdminOverview } from "@/lib/admin/repository";
import { listAdminOnlineMessages } from "@/lib/messages/repository";

function formatBytes(bytes: number) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / (1024 ** index)).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function totalCount(items: Array<{ count: number }>) {
  return items.reduce((total, item) => total + item.count, 0);
}

function percent(count: number, total: number) {
  return total ? Math.max(4, Math.round((count / total) * 100)) : 0;
}

function trendMax(rows: Array<{ assetsCreated: number; uploadBatches: number; downloadedAssets: number }>) {
  return Math.max(1, ...rows.flatMap((row) => [row.assetsCreated, row.uploadBatches, row.downloadedAssets]));
}

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?callbackUrl=/admin");
  if (user.role !== "SUPER_ADMIN") redirect("/");

  const resolvedSearchParams = await searchParams;
  const downloadFilters = parseAdminDownloadBatchFilters(resolvedSearchParams);
  const assetGroupFilters = parseAdminAssetGroupGovernanceFilters(resolvedSearchParams);
  const qualityFilters = parseAdminDataQualityFilters(resolvedSearchParams);
  const auditFilters = parseAdminAuditLogFilters(resolvedSearchParams);
  const uploadFilters = parseAdminUploadTaskFilters(resolvedSearchParams);
  const reportFilters = parseAdminOperationsReportFilters(resolvedSearchParams);
  const overview = await getAdminOverview();
  const downloadBatches = await listAdminDownloadBatches(downloadFilters);
  const assetGroupCoverage = await listAdminAssetGroupCoverage(assetGroupFilters);
  const dataQuality = await listAdminDataQuality(qualityFilters);
  const auditLogs = await listAdminAuditLogs(auditFilters);
  const uploadTasks = await listAdminUploadTasks(uploadFilters);
  const operationsReport = await getAdminOperationsReport(reportFilters);
  const onlineMessages = await listAdminOnlineMessages();
  const policySettings = getAdminPolicySettings();
  const storageHealth = await getAdminStorageHealth();
  const systemStatus = await getAdminSystemStatus(storageHealth);
  const roleTotal = totalCount(overview.roleCounts);
  const uploadStatusTotal = totalCount(overview.uploadStatusCounts);
  const assetTypeTotal = totalCount(overview.assetTypeCounts);
  const categoryTotal = totalCount(overview.categoryTotals);
  const channelTotal = totalCount(overview.channelTotals);
  const trendScale = trendMax(operationsReport.trends);
  const healthScore = systemStatus.overall === "PASS" ? 100 : systemStatus.overall === "WARN" ? 75 : 0;
  const healthLabel = systemStatus.overall === "PASS" ? "正常" : systemStatus.overall === "WARN" ? "需关注" : "异常";
  const storageLabel = systemStatus.storage?.probeStatus === "HEALTHY" ? "健康" : systemStatus.storage?.probeStatus === "DEGRADED" ? "降级" : "待检查";

  return (
    <main className="admin-shell">
      <aside className="admin-rail" aria-label="管理后台导航">
        <Link className="admin-back" href="/"><ArrowLeft aria-hidden="true" />返回素材库</Link>
        <div className="admin-brand"><Shield aria-hidden="true" /><div><strong>管理后台</strong><small>超级管理员工作台</small></div></div>
        <nav>
          <a href="#dashboard"><LayoutDashboard aria-hidden="true" />总览看板</a>
          <a href="#reports"><BarChart3 aria-hidden="true" />运营报表</a>
          <a href="#users"><Users aria-hidden="true" />用户与权限</a>
          <a href="#downloads"><Download aria-hidden="true" />下载记录</a>
          <a href="#uploads"><Upload aria-hidden="true" />上传任务</a>
          <a href="#governance"><Database aria-hidden="true" />素材组治理</a>
          <a href="#quality"><ShieldAlert aria-hidden="true" />质量检查</a>
          <a href="#audit"><ScrollText aria-hidden="true" />审计日志</a>
          <a href="#announcements"><Bell aria-hidden="true" />公告管理</a>
          <a href="#documents"><BookOpen aria-hidden="true" />文档中心</a>
          <a href="#messages"><MessageSquareText aria-hidden="true" />在线留言</a>
          <a href="#policies"><LockKeyhole aria-hidden="true" />策略配置</a>
          <a href="#storage"><HardDrive aria-hidden="true" />存储健康</a>
          <a href="#system"><Shield aria-hidden="true" />系统自检</a>
          <a href="#deployment"><ClipboardCheck aria-hidden="true" />部署清单</a>
        </nav>
      </aside>

      <section className="admin-main">
        <header className="admin-header">
          <div>
            <p>企业素材库</p>
            <h1>超级管理员控制台</h1>
          </div>
          <div className="admin-header-meta"><span className="admin-health-pill"><CheckCircle2 aria-hidden="true" />系统健康</span><span>{user.name} · 超级管理员</span></div>
        </header>

        <section id="dashboard" className="admin-section admin-dashboard-overview" aria-labelledby="admin-dashboard-title">
          <div className="admin-section-heading"><div><p>总览</p><h2 id="admin-dashboard-title">数据仪表盘</h2><span className="admin-heading-note">素材库运营概览与系统健康</span></div><span className="admin-date-badge"><CalendarDays aria-hidden="true" />今日 · {new Date().toLocaleDateString("zh-CN")}</span></div>
          <div className="admin-metrics">
            <article className="metric-blue"><Database aria-hidden="true" /><span>素材总数</span><strong>{overview.metrics.assetTotal}</strong><small>有效素材</small></article>
            <article className="metric-violet"><FileText aria-hidden="true" /><span>素材库 / SPU</span><strong>{overview.metrics.productTotal}</strong><small>已建档产品</small></article>
            <article className="metric-sky"><Users aria-hidden="true" /><span>活跃用户</span><strong>{overview.metrics.activeUsers}</strong><small>当前启用账号</small></article>
            <article className="metric-orange"><Upload aria-hidden="true" /><span>今日新增</span><strong>{overview.metrics.uploadToday}</strong><small>新增素材</small></article>
            <article className="metric-cyan"><Download aria-hidden="true" /><span>今日下载</span><strong>{overview.metrics.downloadToday}</strong><small>下载事件</small></article>
            <article className="metric-indigo"><HardDrive aria-hidden="true" /><span>存储占用</span><strong>{formatBytes(overview.metrics.storageBytes)}</strong><small>有效文件对象</small></article>
            <article className="metric-red"><Bell aria-hidden="true" /><span>待清理文件</span><strong>{overview.metrics.cleanupPending}</strong><small>需要处理</small></article>
            <article className="metric-slate"><BookOpen aria-hidden="true" /><span>内容发布</span><strong>{overview.metrics.publishedAnnouncements + overview.metrics.publishedDocuments}</strong><small>公告 + 文档</small></article>
          </div>
          <div className="admin-dashboard-analytics">
            <article className="admin-panel admin-trend-panel"><div className="admin-panel-heading"><div><p>运营趋势</p><h3>素材流转</h3></div><div className="admin-legend"><span><i className="created" />新增</span><span><i className="uploaded" />上传</span><span><i className="downloaded" />下载</span></div></div><div className="admin-trend-chart" aria-label="最近运营趋势">{operationsReport.trends.slice(-7).map((row) => <div className="admin-trend-row" key={row.date}><time>{row.date.slice(5)}</time><div className="trend-track"><b className="created" style={{ width: `${(row.assetsCreated / trendScale) * 100}%` }} /></div><div className="trend-track"><b className="uploaded" style={{ width: `${(row.uploadBatches / trendScale) * 100}%` }} /></div><div className="trend-track"><b className="downloaded" style={{ width: `${(row.downloadedAssets / trendScale) * 100}%` }} /></div><strong>{row.assetsCreated + row.uploadBatches + row.downloadedAssets}</strong></div>)}</div><footer><span>近 7 天</span><strong>{operationsReport.totals.assetsCreated} 个新增素材</strong><span>失败率 {operationsReport.totals.assetFailureRate}%</span></footer></article>
            <article className="admin-panel admin-health-panel"><div className="admin-panel-heading"><div><p>系统状态</p><h3>运行概况</h3></div><span className={`admin-status ${systemStatus.overall === "PASS" ? "success" : "danger"}`}>{healthLabel}</span></div><div className="health-score"><div><strong>{healthScore}%</strong><span>核心服务可用</span></div><div className="health-ring"><CheckCircle2 aria-hidden="true" /></div></div><div className="health-list"><div><Database aria-hidden="true" /><span>数据库</span><strong>{systemStatus.database.connected ? "已连接" : "异常"}</strong></div><div><HardDrive aria-hidden="true" /><span>本地存储</span><strong>{storageLabel} · {formatBytes(overview.metrics.storageBytes)}</strong></div><div><Shield aria-hidden="true" /><span>权限策略</span><strong>{systemStatus.database.activeSuperAdmins > 0 ? "已启用" : "待配置"}</strong></div></div></article>
          </div>
          <div className="admin-dashboard-grid admin-dashboard-grid--summary">
            <article className="admin-panel"><div className="admin-panel-heading"><div><p>分布</p><h3>图片类型</h3></div><span>{assetTypeTotal} 个</span></div>{overview.assetTypeCounts.length ? overview.assetTypeCounts.map((item) => <div className="admin-bar-row" key={item.assetType}><span>{item.assetType}</span><strong>{item.count}</strong><i><b style={{ width: `${percent(item.count, assetTypeTotal)}%` }} /></i></div>) : <div className="admin-empty compact">暂无素材类型数据。</div>}</article>
            <article className="admin-panel"><div className="admin-panel-heading"><div><p>分布</p><h3>品类素材量</h3></div><span>{categoryTotal} 个</span></div>{overview.categoryTotals.length ? overview.categoryTotals.slice(0, 5).map((item) => <div className="admin-bar-row" key={item.name}><span>{item.name}</span><strong>{item.count}</strong><i><b style={{ width: `${percent(item.count, categoryTotal)}%` }} /></i></div>) : <div className="admin-empty compact">暂无品类数据。</div>}</article>
            <article className="admin-panel"><div className="admin-panel-heading"><div><p>分布</p><h3>渠道素材量</h3></div><span>{channelTotal} 个</span></div>{overview.channelTotals.length ? overview.channelTotals.slice(0, 5).map((item) => <div className="admin-bar-row" key={item.name}><span>{item.name}</span><strong>{item.count}</strong><i><b style={{ width: `${percent(item.count, channelTotal)}%` }} /></i></div>) : <div className="admin-empty compact">暂无渠道数据。</div>}</article>
          </div>
          <div className="admin-dashboard-grid two">
            <article className="admin-panel"><div className="admin-panel-heading"><div><p>账号</p><h3>角色分布</h3></div><span>{roleTotal} 个账号</span></div>{overview.roleCounts.map((item) => <div className="admin-bar-row" key={item.role}><span>{item.label}</span><strong>{item.count}</strong><i><b style={{ width: `${percent(item.count, roleTotal)}%` }} /></i></div>)}</article>
            <article className="admin-panel"><div className="admin-panel-heading"><div><p>任务</p><h3>上传状态</h3></div><span>{uploadStatusTotal} 个批次</span></div>{overview.uploadStatusCounts.map((item) => <div className="admin-bar-row" key={item.status}><span>{uiLabel(uploadStatusLabels, item.status)}</span><strong>{item.count}</strong><i><b style={{ width: `${percent(item.count, uploadStatusTotal)}%` }} /></i></div>)}</article>
          </div>
        </section>

        <section className="admin-section" id="reports" aria-labelledby="admin-reports-title">
          <div className="admin-section-heading"><div><p>报表</p><h2 id="admin-reports-title">运营报表</h2></div><small>上传、下载与失败趋势</small></div>
          <OperationsReportPanel report={operationsReport} />
        </section>

        <div className="admin-grid-2">
          <section className="admin-section" id="users" aria-labelledby="admin-users-title">
            <UserManagementPanel users={overview.users} />
          </section>

          <section className="admin-section" aria-labelledby="admin-top-download-title">
            <div className="admin-section-heading"><div><p>排行</p><h2 id="admin-top-download-title">下载用户 TOP</h2></div><small>按审计日志统计</small></div>
            <div className="admin-list">{overview.topDownloadUsers.length ? overview.topDownloadUsers.map((item) => <article key={item.id}><div><strong>{item.name}</strong><small>{item.email}</small></div><span>{item.downloads} 次</span></article>) : <div className="admin-empty">暂无下载记录。</div>}</div>
            <div className="admin-action-note"><Activity aria-hidden="true" />下载批次详情、IP、User-Agent 和 CSV 导出已在下载记录中提供。</div>
          </section>
        </div>

        <section className="admin-section" id="downloads" aria-labelledby="admin-downloads-title">
          <div className="admin-section-heading"><div><p>下载审计</p><h2 id="admin-downloads-title">下载记录</h2></div><small>记录用户下载内容与时间</small></div>
          <DownloadBatchPanel batches={downloadBatches.items} page={downloadBatches.page} totalPages={downloadBatches.totalPages} total={downloadBatches.total} filters={downloadBatches.filters} />
          <div className="admin-subsection-heading"><p>历史记录</p><h3>单图与历史审计记录</h3></div>
          <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>时间</th><th>用户</th><th>类型</th><th>素材</th><th>SPU</th><th>品类</th><th>渠道</th></tr></thead><tbody>{overview.recentDownloads.map((item) => <tr key={item.id}><td>{item.createdAt}</td><td><strong>{item.user}</strong><small>{item.email}</small></td><td>{item.action}</td><td>{item.filename}</td><td>{item.spu}</td><td>{item.category}</td><td>{item.channel}</td></tr>)}</tbody></table></div>
        </section>

        <section className="admin-section" id="uploads" aria-labelledby="admin-uploads-title">
          <div className="admin-section-heading"><div><p>上传</p><h2 id="admin-uploads-title">上传任务</h2></div><small>上传批次与处理结果</small></div>
          <UploadTaskPanel uploadTasks={uploadTasks} />
        </section>

        <section className="admin-section" id="governance" aria-labelledby="admin-governance-title">
          <div className="admin-section-heading"><div><p>治理</p><h2 id="admin-governance-title">素材组治理</h2></div><small>SPU 覆盖与缺图检查</small></div>
          <AssetGroupGovernancePanel coverage={assetGroupCoverage} />
        </section>

        <section className="admin-section" id="quality" aria-labelledby="admin-quality-title">
          <div className="admin-section-heading"><div><p>质量</p><h2 id="admin-quality-title">质量检查</h2></div><small>命名、派生图、尺寸与重复图检查</small></div>
          <DataQualityPanel quality={dataQuality} />
        </section>

        <section className="admin-section" id="audit" aria-labelledby="admin-audit-title">
          <div className="admin-section-heading"><div><p>审计</p><h2 id="admin-audit-title">审计日志</h2></div><small>筛选、展开详情与导出</small></div>
          <AuditLogPanel auditLogs={auditLogs} />
        </section>

        <section className="admin-section" id="messages" aria-labelledby="admin-messages-title">
          <div className="admin-section-heading"><div><p>沟通</p><h2 id="admin-messages-title">在线留言</h2></div><small>用户提交的需求与问题</small></div>
          <OnlineMessagePanel initialMessages={onlineMessages} />
        </section>

        <div className="admin-grid-2 content">
          <section className="admin-section" id="announcements" aria-labelledby="admin-announcements-title"><AnnouncementManagementPanel announcements={overview.announcements} /></section>
          <section className="admin-section" id="documents" aria-labelledby="admin-documents-title"><DocumentManagementPanel documents={overview.documentPages} /></section>
        </div>

        <section className="admin-section" id="policies" aria-labelledby="admin-policies-title">
          <div className="admin-section-heading"><div><p>策略</p><h2 id="admin-policies-title">策略配置</h2></div><small>上传、下载、权限与内容规则</small></div>
          <PolicySettingsPanel settings={policySettings} />
        </section>

        <section className="admin-section" id="storage" aria-labelledby="admin-storage-title">
          <div className="admin-section-heading"><div><p>存储</p><h2 id="admin-storage-title">存储与系统健康</h2></div><small>通用存储驱动健康检查</small></div>
          <StorageHealthPanel initialHealth={storageHealth} />
        </section>

        <section className="admin-section" id="system" aria-labelledby="admin-system-title">
          <div className="admin-section-heading"><div><p>系统</p><h2 id="admin-system-title">系统自检</h2></div><small>部署前配置与运行状态</small></div>
          <SystemStatusPanel initialStatus={systemStatus} />
        </section>

        <section className="admin-section" id="deployment" aria-labelledby="admin-deployment-title">
          <div className="admin-section-heading"><div><p>清单</p><h2 id="admin-deployment-title">部署清单</h2></div><small>发布、备份、恢复与验收步骤</small></div>
          <DeploymentRunbookPanel />
        </section>
      </section>
    </main>
  );
}
type AdminPageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };
