import Link from "next/link";
import { redirect } from "next/navigation";
import { Activity, ArrowLeft, Bell, BookOpen, Database, Download, FileText, HardDrive, LayoutDashboard, Shield, Upload, Users } from "lucide-react";
import { AnnouncementManagementPanel } from "@/components/admin/announcement-management-panel";
import { DocumentManagementPanel } from "@/components/admin/document-management-panel";
import { UserManagementPanel } from "@/components/admin/user-management-panel";
import { getCurrentUser } from "@/lib/auth/server";
import { getAdminOverview } from "@/lib/admin/repository";

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

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?callbackUrl=/admin");
  if (user.role !== "SUPER_ADMIN") redirect("/");

  const overview = await getAdminOverview();
  const roleTotal = totalCount(overview.roleCounts);
  const uploadStatusTotal = totalCount(overview.uploadStatusCounts);
  const assetTypeTotal = totalCount(overview.assetTypeCounts);
  const categoryTotal = totalCount(overview.categoryTotals);
  const channelTotal = totalCount(overview.channelTotals);

  return (
    <main className="admin-shell">
      <aside className="admin-rail" aria-label="管理后台导航">
        <Link className="admin-back" href="/"><ArrowLeft aria-hidden="true" />返回素材库</Link>
        <div className="admin-brand"><Shield aria-hidden="true" /><div><strong>管理后台</strong><small>超级管理员工作台</small></div></div>
        <nav>
          <a href="#dashboard"><LayoutDashboard aria-hidden="true" />总览看板</a>
          <a href="#users"><Users aria-hidden="true" />用户与权限</a>
          <a href="#downloads"><Download aria-hidden="true" />下载记录</a>
          <a href="#uploads"><Upload aria-hidden="true" />上传任务</a>
          <a href="#announcements"><Bell aria-hidden="true" />公告管理</a>
          <a href="#documents"><BookOpen aria-hidden="true" />文档中心</a>
          <a href="#storage"><HardDrive aria-hidden="true" />存储与 NAS</a>
        </nav>
      </aside>

      <section className="admin-main">
        <header className="admin-header">
          <div>
            <p>Enterprise Image Library</p>
            <h1>超级管理员控制台</h1>
          </div>
          <span>{user.name} · 超级管理员</span>
        </header>

        <section id="dashboard" className="admin-section" aria-labelledby="admin-dashboard-title">
          <div className="admin-section-heading"><div><p>Dashboard</p><h2 id="admin-dashboard-title">总览看板</h2></div><small>今日数据与系统健康</small></div>
          <div className="admin-metrics">
            <article><Database aria-hidden="true" /><span>素材总数</span><strong>{overview.metrics.assetTotal}</strong></article>
            <article><FileText aria-hidden="true" /><span>素材库/SPU</span><strong>{overview.metrics.productTotal}</strong></article>
            <article><Users aria-hidden="true" /><span>活跃用户</span><strong>{overview.metrics.activeUsers}</strong></article>
            <article><Upload aria-hidden="true" /><span>今日新增</span><strong>{overview.metrics.uploadToday}</strong></article>
            <article><Download aria-hidden="true" /><span>今日下载</span><strong>{overview.metrics.downloadToday}</strong></article>
            <article><HardDrive aria-hidden="true" /><span>存储占用</span><strong>{formatBytes(overview.metrics.storageBytes)}</strong></article>
            <article><Bell aria-hidden="true" /><span>待清理文件</span><strong>{overview.metrics.cleanupPending}</strong></article>
            <article><Bell aria-hidden="true" /><span>已发布公告</span><strong>{overview.metrics.publishedAnnouncements}</strong></article>
            <article><BookOpen aria-hidden="true" /><span>已发布文档</span><strong>{overview.metrics.publishedDocuments}</strong></article>
          </div>
          <div className="admin-dashboard-grid">
            <article className="admin-panel"><h3>角色分布</h3>{overview.roleCounts.map((item) => <div className="admin-bar-row" key={item.role}><span>{item.label}</span><strong>{item.count}</strong><i><b style={{ width: `${percent(item.count, roleTotal)}%` }} /></i></div>)}</article>
            <article className="admin-panel"><h3>上传状态</h3>{overview.uploadStatusCounts.map((item) => <div className="admin-bar-row" key={item.status}><span>{item.status}</span><strong>{item.count}</strong><i><b style={{ width: `${percent(item.count, uploadStatusTotal)}%` }} /></i></div>)}</article>
            <article className="admin-panel"><h3>图片类型分布</h3>{overview.assetTypeCounts.length ? overview.assetTypeCounts.map((item) => <div className="admin-bar-row" key={item.assetType}><span>{item.assetType}</span><strong>{item.count}</strong><i><b style={{ width: `${percent(item.count, assetTypeTotal)}%` }} /></i></div>) : <div className="admin-empty compact">暂无素材类型数据。</div>}</article>
          </div>
          <div className="admin-dashboard-grid two">
            <article className="admin-panel"><h3>公告状态</h3>{overview.announcementStatusCounts.length ? overview.announcementStatusCounts.map((item) => <div className="admin-bar-row" key={item.status}><span>{item.status}</span><strong>{item.count}</strong><i><b style={{ width: `${percent(item.count, totalCount(overview.announcementStatusCounts))}%` }} /></i></div>) : <div className="admin-empty compact">暂无公告数据。</div>}</article>
            <article className="admin-panel"><h3>文档状态</h3>{overview.documentStatusCounts.length ? overview.documentStatusCounts.map((item) => <div className="admin-bar-row" key={item.status}><span>{item.status}</span><strong>{item.count}</strong><i><b style={{ width: `${percent(item.count, totalCount(overview.documentStatusCounts))}%` }} /></i></div>) : <div className="admin-empty compact">暂无文档数据。</div>}</article>
          </div>
          <div className="admin-dashboard-grid two">
            <article className="admin-panel"><h3>品类素材量</h3>{overview.categoryTotals.length ? overview.categoryTotals.map((item) => <div className="admin-bar-row" key={item.name}><span>{item.name}</span><strong>{item.count}</strong><i><b style={{ width: `${percent(item.count, categoryTotal)}%` }} /></i></div>) : <div className="admin-empty compact">暂无品类数据。</div>}</article>
            <article className="admin-panel"><h3>渠道素材量</h3>{overview.channelTotals.length ? overview.channelTotals.map((item) => <div className="admin-bar-row" key={item.name}><span>{item.name}</span><strong>{item.count}</strong><i><b style={{ width: `${percent(item.count, channelTotal)}%` }} /></i></div>) : <div className="admin-empty compact">暂无渠道数据。</div>}</article>
          </div>
        </section>

        <div className="admin-grid-2">
          <section className="admin-section" id="users" aria-labelledby="admin-users-title">
            <UserManagementPanel users={overview.users} />
          </section>

          <section className="admin-section" aria-labelledby="admin-top-download-title">
            <div className="admin-section-heading"><div><p>Ranking</p><h2 id="admin-top-download-title">下载用户 TOP</h2></div><small>按审计日志统计</small></div>
            <div className="admin-list">{overview.topDownloadUsers.length ? overview.topDownloadUsers.map((item) => <article key={item.id}><div><strong>{item.name}</strong><small>{item.email}</small></div><span>{item.downloads} 次</span></article>) : <div className="admin-empty">暂无下载记录。</div>}</div>
            <div className="admin-action-note"><Activity aria-hidden="true" />后续会补下载批次详情、IP、User-Agent 和导出 CSV。</div>
          </section>
        </div>

        <section className="admin-section" id="downloads" aria-labelledby="admin-downloads-title">
          <div className="admin-section-heading"><div><p>Audit</p><h2 id="admin-downloads-title">下载记录</h2></div><small>记录用户下载内容与时间</small></div>
          <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>时间</th><th>用户</th><th>类型</th><th>素材</th><th>SPU</th><th>品类</th><th>渠道</th></tr></thead><tbody>{overview.recentDownloads.map((item) => <tr key={item.id}><td>{item.createdAt}</td><td><strong>{item.user}</strong><small>{item.email}</small></td><td>{item.action}</td><td>{item.filename}</td><td>{item.spu}</td><td>{item.category}</td><td>{item.channel}</td></tr>)}</tbody></table></div>
        </section>

        <section className="admin-section" id="uploads" aria-labelledby="admin-uploads-title">
          <div className="admin-section-heading"><div><p>Uploads</p><h2 id="admin-uploads-title">上传任务</h2></div><small>上传批次与处理结果</small></div>
          <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>时间</th><th>上传人</th><th>状态</th><th>SPU</th><th>品类</th><th>渠道</th><th>素材数</th></tr></thead><tbody>{overview.recentUploads.map((item) => <tr key={item.id}><td>{item.createdAt}</td><td><strong>{item.uploader}</strong><small>{item.email}</small></td><td>{item.status}</td><td>{item.spu}</td><td>{item.category}</td><td>{item.channel}</td><td>{item.assetCount}</td></tr>)}</tbody></table></div>
        </section>

        <section className="admin-section" aria-labelledby="admin-actions-title">
          <div className="admin-section-heading"><div><p>Audit</p><h2 id="admin-actions-title">最近管理操作</h2></div><small>审计日志不可编辑</small></div>
          <div className="admin-list dense">{overview.recentAdminActions.map((item) => <article key={item.id}><div><strong>{item.action}</strong><small>{item.actor} · {item.email}</small></div><span>{item.createdAt}</span></article>)}</div>
        </section>

        <div className="admin-grid-2 content">
          <section className="admin-section" id="announcements" aria-labelledby="admin-announcements-title"><AnnouncementManagementPanel announcements={overview.announcements} /></section>
          <section className="admin-section" id="documents" aria-labelledby="admin-documents-title"><DocumentManagementPanel documents={overview.documentPages} /></section>
        </div>

        <section className="admin-section" id="storage" aria-labelledby="admin-storage-title"><div className="admin-section-heading"><div><p>Storage</p><h2 id="admin-storage-title">存储与 NAS</h2></div><button className="admin-secondary-button" type="button" disabled>健康检查</button></div><div className="admin-checklist"><p>当前驱动：local，存储占用 {formatBytes(overview.metrics.storageBytes)}</p><p>待清理文件：{overview.metrics.cleanupPending}</p><p>下一步接入 NAS 容量、读写延迟、迁移 dry-run。</p></div></section>
      </section>
    </main>
  );
}
