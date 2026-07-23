import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { Prisma } from "@prisma/client";
import packageJson from "@/package.json";
import { getAdminStorageHealth, type AdminStorageHealth } from "@/lib/admin/storage-health";
import { prisma } from "@/lib/prisma";

type CheckStatus = "PASS" | "WARN" | "FAIL";

type MigrationRow = {
  migration_name: string;
  finished_at: Date | null;
};

function compactDateTime(value: Date | null) {
  return value ? value.toLocaleString("zh-CN", { hour12: false }) : "-";
}

function envPresent(name: string) {
  const value = process.env[name];
  return Boolean(value && value.trim());
}

function safeDatabaseTarget() {
  const value = process.env.DATABASE_URL;
  if (!value) return "未配置";
  try {
    const url = new URL(value);
    return `${url.protocol}//${url.hostname}${url.port ? `:${url.port}` : ""}${url.pathname}`;
  } catch {
    return "DATABASE_URL 格式无法解析";
  }
}

function check(id: string, label: string, status: CheckStatus, message: string) {
  return { id, label, status, message };
}

function overallStatus(items: Array<{ status: CheckStatus }>): CheckStatus {
  if (items.some((item) => item.status === "FAIL")) return "FAIL";
  if (items.some((item) => item.status === "WARN")) return "WARN";
  return "PASS";
}

async function listMigrationFolders() {
  try {
    const entries = await readdir(join(process.cwd(), "prisma", "migrations"), { withFileTypes: true });
    return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).filter((name) => name !== "migration_lock.toml").sort();
  } catch {
    return [];
  }
}

async function listAppliedMigrations() {
  try {
    return await prisma.$queryRaw<MigrationRow[]>(Prisma.sql`
      SELECT migration_name, finished_at
      FROM "_prisma_migrations"
      WHERE rolled_back_at IS NULL
      ORDER BY migration_name ASC
    `);
  } catch {
    return [];
  }
}

export async function getAdminSystemStatus(existingStorageHealth?: AdminStorageHealth) {
  const checkedAt = new Date();
  const [databasePing, activeSuperAdmins, activeUsers, migrationFolders, appliedMigrations, storageHealth] = await Promise.all([
    prisma.$queryRaw<Array<{ ok: number }>>(Prisma.sql`SELECT 1 AS ok`).then(() => true).catch(() => false),
    prisma.user.count({ where: { role: "SUPER_ADMIN", status: "ACTIVE" } }).catch(() => 0),
    prisma.user.count({ where: { status: "ACTIVE" } }).catch(() => 0),
    listMigrationFolders(),
    listAppliedMigrations(),
    existingStorageHealth ? Promise.resolve(existingStorageHealth) : getAdminStorageHealth().catch(() => null),
  ]);
  const appliedNames = new Set(appliedMigrations.map((migration) => migration.migration_name));
  const pendingMigrations = migrationFolders.filter((name) => !appliedNames.has(name));
  const lastAppliedMigration = appliedMigrations.at(-1);
  const environmentChecks = [
    check("database-url", "DATABASE_URL", envPresent("DATABASE_URL") ? "PASS" : "FAIL", safeDatabaseTarget()),
    check("auth-secret", "AUTH_SECRET", envPresent("AUTH_SECRET") && (process.env.AUTH_SECRET?.length ?? 0) >= 32 ? "PASS" : "WARN", envPresent("AUTH_SECRET") ? "已配置，不显示密钥内容。" : "未配置登录会话密钥。"),
    check("storage-driver", "STORAGE_DRIVER", (process.env.STORAGE_DRIVER ?? "local") === "local" ? "PASS" : "WARN", `当前驱动：${process.env.STORAGE_DRIVER ?? "local"}`),
    check("storage-root", "LOCAL_STORAGE_ROOT", envPresent("LOCAL_STORAGE_ROOT") ? "PASS" : "WARN", process.env.LOCAL_STORAGE_ROOT ?? "未配置，使用 ./data/storage"),
  ];
  const databaseChecks = [
    check("database-ping", "数据库连接", databasePing ? "PASS" : "FAIL", databasePing ? "Prisma 查询通过。" : "Prisma 无法连接数据库。"),
    check("migrations", "数据库迁移", pendingMigrations.length === 0 ? "PASS" : "WARN", pendingMigrations.length === 0 ? `已应用 ${appliedMigrations.length}/${migrationFolders.length} 个迁移。` : `待应用 ${pendingMigrations.length} 个迁移。`),
    check("super-admin", "超级管理员", activeSuperAdmins > 0 ? "PASS" : "FAIL", `活跃超级管理员：${activeSuperAdmins}`),
  ];
  const storageChecks = storageHealth
    ? [
        check("storage-probe", "存储读写", storageHealth.probe.status === "HEALTHY" ? "PASS" : storageHealth.probe.status === "FAILED" ? "FAIL" : "WARN", storageHealth.probe.message),
        check("file-existence", "文件抽样", storageHealth.fileExistenceScan.missingCount === 0 ? "PASS" : "WARN", `抽样缺失 key：${storageHealth.fileExistenceScan.missingCount}`),
        check("cleanup-queue", "清理队列", storageHealth.pendingActiveReferenceCount === 0 ? "PASS" : "WARN", `待清理但仍有活动引用：${storageHealth.pendingActiveReferenceCount}`),
      ]
    : [check("storage-probe", "存储读写", "FAIL", "存储健康检查无法完成。")];
  const checks = [...environmentChecks, ...databaseChecks, ...storageChecks];

  return {
    checkedAt: compactDateTime(checkedAt),
    overall: overallStatus(checks),
    app: {
      name: packageJson.name,
      version: packageJson.version,
      nodeEnv: process.env.NODE_ENV ?? "development",
      nextVersion: packageJson.dependencies.next,
      prismaVersion: packageJson.dependencies["@prisma/client"],
    },
    database: {
      target: safeDatabaseTarget(),
      connected: databasePing,
      activeUsers,
      activeSuperAdmins,
      migrationFolders: migrationFolders.length,
      appliedMigrations: appliedMigrations.length,
      pendingMigrations,
      lastAppliedMigration: lastAppliedMigration ? { name: lastAppliedMigration.migration_name, finishedAt: compactDateTime(lastAppliedMigration.finished_at) } : null,
    },
    storage: storageHealth
      ? {
          driver: storageHealth.driver,
          root: storageHealth.root,
          probeStatus: storageHealth.probe.status,
          storageBytes: storageHealth.storageBytes,
          missingKeys: storageHealth.fileExistenceScan.missingCount,
          cleanupCandidates: storageHealth.cleanupCandidates.length,
        }
      : null,
    checks,
  };
}

export type AdminSystemStatus = Awaited<ReturnType<typeof getAdminSystemStatus>>;
