"use client";

import { ClipboardCheck, DatabaseBackup, RotateCcw, Rocket, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type RunbookItem = {
  id: string;
  text: string;
  command?: string;
};

type RunbookSection = {
  id: string;
  title: string;
  icon: "rocket" | "backup" | "restore" | "verify" | "deploy";
  items: RunbookItem[];
};

const storageKey = "admin-deployment-runbook-v1";

const sections: RunbookSection[] = [
  {
    id: "first-deploy",
    title: "首次部署",
    icon: "rocket",
    items: [
      { id: "env", text: "复制并配置 .env，确认 DATABASE_URL、AUTH_SECRET、LOCAL_STORAGE_ROOT 已替换占位值。" },
      { id: "storage-root", text: "确认 LOCAL_STORAGE_ROOT 可被服务账号写入，并位于发布目录之外。" },
      { id: "install", text: "安装依赖并生成 Prisma Client。", command: "npm ci && npm run db:generate" },
      { id: "deploy-migrations", text: "只应用已提交迁移，不在部署环境创建新迁移。", command: "npm run db:deploy" },
      { id: "seed-admin", text: "仅首次管理员需要设置 DEV_ADMIN_* 并执行 seed。", command: "npm run db:seed" },
    ],
  },
  {
    id: "release",
    title: "迁移发布",
    icon: "deploy",
    items: [
      { id: "paired-backup", text: "发布前创建 PostgreSQL 与存储根的成对备份。" },
      { id: "maintenance", text: "需要停写的结构变更进入维护窗口。" },
      { id: "release-build", text: "在候选版本上完成 lint、typecheck、test 和 build。", command: "npm run lint && npm run typecheck && npm run test && npm run build" },
      { id: "release-deploy", text: "部署新版本并执行生产迁移。", command: "npm run db:deploy" },
      { id: "keep-previous", text: "保留上一版本和成对备份，直到验证完成。" },
    ],
  },
  {
    id: "backup",
    title: "备份",
    icon: "backup",
    items: [
      { id: "backup-window", text: "暂停写入或进入维护窗口，确保数据库与文件状态成对。" },
      { id: "backup-id", text: "为数据库 dump、存储压缩包和校验文件使用同一个备份 ID。" },
      { id: "pg-dump", text: "导出 PostgreSQL 自定义格式备份。", command: "pg_dump --format=custom --file=\"$IMAGE_LIBRARY_BACKUP_DIR/$IMAGE_LIBRARY_BACKUP_ID.database.dump\" \"$DATABASE_URL\"" },
      { id: "tar-storage", text: "打包当前 LOCAL_STORAGE_ROOT。", command: "tar -C \"$LOCAL_STORAGE_ROOT\" -czf \"$IMAGE_LIBRARY_BACKUP_DIR/$IMAGE_LIBRARY_BACKUP_ID.storage.tar.gz\" ." },
      { id: "checksum", text: "为数据库和存储备份生成 SHA-256 校验。", command: "shasum -a 256 \"$IMAGE_LIBRARY_BACKUP_DIR/$IMAGE_LIBRARY_BACKUP_ID.database.dump\" \"$IMAGE_LIBRARY_BACKUP_DIR/$IMAGE_LIBRARY_BACKUP_ID.storage.tar.gz\" > \"$IMAGE_LIBRARY_BACKUP_DIR/$IMAGE_LIBRARY_BACKUP_ID.sha256\"" },
    ],
  },
  {
    id: "restore",
    title: "隔离恢复",
    icon: "restore",
    items: [
      { id: "restore-isolated", text: "只恢复到隔离数据库和空的隔离存储根，禁止直接覆盖共享环境。" },
      { id: "restore-checksum", text: "恢复前校验备份完整性。", command: "shasum -a 256 -c \"$IMAGE_LIBRARY_BACKUP_DIR/$IMAGE_LIBRARY_BACKUP_ID.sha256\"" },
      { id: "restore-db", text: "恢复数据库到隔离 DATABASE_URL。", command: "pg_restore --clean --if-exists --no-owner --dbname=\"$IMAGE_LIBRARY_RESTORE_DATABASE_URL\" \"$IMAGE_LIBRARY_BACKUP_DIR/$IMAGE_LIBRARY_BACKUP_ID.database.dump\"" },
      { id: "restore-storage", text: "恢复存储文件到空目录。", command: "tar -C \"$IMAGE_LIBRARY_RESTORE_STORAGE_ROOT\" -xzf \"$IMAGE_LIBRARY_BACKUP_DIR/$IMAGE_LIBRARY_BACKUP_ID.storage.tar.gz\"" },
      { id: "restore-no-key-edit", text: "不手工修改数据库中的 storageKey 或写入绝对路径。" },
    ],
  },
  {
    id: "verify",
    title: "发布后验收",
    icon: "verify",
    items: [
      { id: "login", text: "使用超级管理员账号登录后台，确认系统自检为通过或仅剩可接受的警告。" },
      { id: "library", text: "验证素材库筛选、搜索、分页和预览正常。" },
      { id: "download", text: "验证单图下载与 ZIP 批量下载，后台下载批次有记录。" },
      { id: "upload", text: "上传一组测试素材，确认缩略图、预览图和原图下载正常。" },
      { id: "logs", text: "检查上传任务、审计日志、运营报表和存储健康没有新增异常。" },
    ],
  },
];

function iconFor(icon: RunbookSection["icon"]) {
  if (icon === "backup") return <DatabaseBackup aria-hidden="true" />;
  if (icon === "restore") return <RotateCcw aria-hidden="true" />;
  if (icon === "verify") return <ShieldCheck aria-hidden="true" />;
  if (icon === "deploy") return <ClipboardCheck aria-hidden="true" />;
  return <Rocket aria-hidden="true" />;
}

function loadSavedChecked() {
  if (typeof window === "undefined") return new Set<string>();
  try {
    const saved = window.localStorage.getItem(storageKey);
    return saved ? new Set(JSON.parse(saved) as string[]) : new Set<string>();
  } catch {
    return new Set<string>();
  }
}

export function DeploymentRunbookPanel() {
  const [checked, setChecked] = useState<Set<string>>(() => loadSavedChecked());
  const allItems = useMemo(() => sections.flatMap((section) => section.items), []);
  const completed = checked.size;

  useEffect(() => {
    window.localStorage.setItem(storageKey, JSON.stringify([...checked]));
  }, [checked]);

  function toggle(itemId: string) {
    setChecked((current) => {
      const next = new Set(current);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }

  function reset() {
    setChecked(new Set());
  }

  return (
    <div className="admin-runbook-module">
      <div className="admin-runbook-summary">
        <div><strong>{completed}/{allItems.length}</strong><span>部署清单完成度</span></div>
        <i><b style={{ width: `${(completed / allItems.length) * 100}%` }} /></i>
        <p>仅保存勾选状态，不执行命令。</p>
        <button className="admin-secondary-button" type="button" onClick={reset}>重置清单</button>
      </div>

      <div className="admin-runbook-list">
        {sections.map((section) => {
          const done = section.items.filter((item) => checked.has(item.id)).length;
          return (
            <article key={section.id}>
              <header>{iconFor(section.icon)}<div><h3>{section.title}</h3><small>{done}/{section.items.length} 已完成</small></div></header>
              <div className="admin-runbook-items">
                {section.items.map((item) => (
                  <label key={item.id} className={checked.has(item.id) ? "is-checked" : ""}>
                    <input type="checkbox" checked={checked.has(item.id)} onChange={() => toggle(item.id)} />
                    <span><strong>{item.text}</strong>{item.command && <code>{item.command}</code>}</span>
                  </label>
                ))}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
