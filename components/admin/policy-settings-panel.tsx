import { Archive, Download, Eye, HardDrive, LockKeyhole, Tags, Upload } from "lucide-react";
import type { AdminPolicySettings } from "@/lib/admin/policy-settings";

type PolicySettingsPanelProps = {
  settings: AdminPolicySettings;
};

type PolicyItem = {
  label: string;
  value: string;
  source: string;
};

function PolicyList({ items }: { items: PolicyItem[] }) {
  return <div className="admin-policy-list">{items.map((item) => <article key={item.label}><strong>{item.label}</strong><span>{item.value}</span><small>{item.source}</small></article>)}</div>;
}

export function PolicySettingsPanel({ settings }: PolicySettingsPanelProps) {
  return (
    <div className="admin-policy-module">
      <div className="admin-action-note"><LockKeyhole aria-hidden="true" />当前为只读策略视图，用于核对实际生效规则；在线修改策略应在权限、审计和回滚设计完成后再开放。</div>
      <div className="admin-policy-grid">
        <section className="admin-policy-card"><header><Upload aria-hidden="true" /><h3>上传策略</h3></header><PolicyList items={settings.uploadLimits} /></section>
        <section className="admin-policy-card"><header><Archive aria-hidden="true" /><h3>ZIP 策略</h3></header><PolicyList items={settings.archiveLimits} /></section>
        <section className="admin-policy-card"><header><Download aria-hidden="true" /><h3>下载策略</h3></header><PolicyList items={settings.downloadRules} /></section>
        <section className="admin-policy-card"><header><HardDrive aria-hidden="true" /><h3>存储策略</h3></header><PolicyList items={settings.storageRules} /></section>
      </div>

      <div className="admin-policy-grid two">
        <section className="admin-policy-card"><header><Tags aria-hidden="true" /><h3>国家与图片类型</h3></header><div className="admin-policy-tags"><div><strong>国家</strong>{settings.taxonomy.countries.map((item) => <span key={item}>{item}</span>)}</div><div><strong>图片类型</strong>{settings.taxonomy.assetTypes.map((item) => <span key={item}>{item}</span>)}</div><div><strong>ZIP 语言目录</strong>{settings.taxonomy.archiveLanguageMappings.map((item) => <span key={item}>{item}</span>)}</div></div></section>
        <section className="admin-policy-card"><header><Eye aria-hidden="true" /><h3>公告与文档策略</h3></header><PolicyList items={settings.contentRules} /></section>
      </div>

      <section className="admin-policy-card"><header><LockKeyhole aria-hidden="true" /><h3>角色权限</h3></header><div className="admin-policy-permissions">{settings.permissions.map((item) => <article key={item.role}><strong>{item.label}</strong><small>{item.role}</small><span>{item.permissions.join("、")}</span></article>)}</div></section>
    </div>
  );
}
