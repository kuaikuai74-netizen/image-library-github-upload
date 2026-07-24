# 跨境电商视觉资产

用于集中管理电商静态图片素材的企业系统。目标能力包括渠道、品类、素材组、国家、图片类型、颜色、SPU 搜索、预览、批量选择、上传、下载、登录与权限管理。

## 当前状态

阶段一已增加 Next.js + TypeScript 静态素材库页面。旧 `index.html` 仍保留为设计原型；新页面使用集中 mock 数据实现筛选、选择、预览和响应式布局，不包含真实后端、数据库、登录或持久化文件存储。

当前阶段已具备账号密码登录、角色权限基础、Prisma 素材数据模型和数据库查询 API。页面筛选、统计和分页从数据库读取；上传通过服务端 `StorageService` 写入本地目录，并生成缩略图和预览图。暂不接入绿联 NAS。

业务展示口径中，`1 个 SPU = 1 个素材组`。同一 SPU 下按国家、图片类型或其他字段拆出的多条内部存储记录，不会在品类卡片和浏览范围统计中重复计算为多个素材组。

## 目标技术栈

- Next.js + TypeScript
- PostgreSQL + Prisma
- Auth.js
- Sharp
- 通过服务端 `StorageService` 管理本地文件存储

详细约束见 [AGENTS.md](AGENTS.md)，设计说明见 [docs/architecture.md](docs/architecture.md)，阶段计划见 [docs/development-plan.md](docs/development-plan.md)。

## 本地开发

```bash
npm install
npm run dev
```

`npm run dev` 会先执行 `prisma generate` 和 `prisma migrate deploy`，再启动 Next.js，避免本地数据库或 Prisma Client 落后于代码。若开发过程中新增或修改了 Prisma 模型，需要重启正在运行的 dev server；运行中的 Node 进程不会自动重新加载已生成的 Prisma Client。

访问 `http://localhost:3000` 登录并查看素材库。`index.html` 只用于查看历史设计原型。

超级管理员登录后，顶部会出现“管理后台”入口，可访问 `/admin` 查看总览看板、运营报表、用户与权限、下载记录、上传任务、素材组治理、质量检查、审计日志、公告管理、文档中心、策略配置、存储健康、系统自检和部署清单。当前后台已支持新建用户、编辑用户、启用/禁用用户、重置密码、发布/编辑公告，以及新建/编辑使用文档。普通用户可在素材库首页查看有权限的已发布公告并标记已读，也可通过顶部“使用文档”进入 `/docs` 阅读有权限的已发布文档。

如果只是稳定预览当前页面，使用：

```bash
npm run preview
```

该命令会先重新构建，再用生产服务启动 `http://localhost:3000`，避免开发服务器文件监听异常或旧缓存导致页面样式不一致。

## 环境变量

正式应用初始化后，从 `.env.example` 创建本地 `.env`。不要提交 `.env`、真实密钥、数据库密码或 NAS 凭据。

登录开发环境前，需要配置 PostgreSQL 和本地 `.env`，然后执行：

```bash
npm run db:migrate
npm run db:seed
```

seed 使用 `DEV_ADMIN_EMAIL`、`DEV_ADMIN_USERNAME` 和 `DEV_ADMIN_PASSWORD` 创建或更新 `SUPER_ADMIN` 账号；不会在仓库中保存明文密码。

真实素材本地测试前，可以清空 seed 或临时上传的素材数据：

```bash
npm run clear:assets
```

该命令保留登录账号、渠道和品类，只删除商品、素材组、素材、文件对象、上传请求、审计日志，以及 `LOCAL_STORAGE_ROOT` 下应用使用的素材目录。

## 部署

生产或局域网部署使用 `npm run db:deploy` 应用已提交的 Prisma 迁移；`npm run db:migrate` 只用于本地开发时创建新迁移。部署、备份和隔离恢复的完整步骤见 [docs/deployment.md](docs/deployment.md)。

## 测试与质量检查

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

`npm run build` 会先执行 `prisma generate`，确保生产构建使用最新 Prisma Client。数据库迁移仍应通过 `npm run db:deploy` 在部署步骤中执行。

`npm run test` 仅运行不依赖外部服务的单元测试。它覆盖权限、存储键生成、本地存储、真实图片解码验证、排序约定和重复文件复用判断。

集成测试和 E2E 不会因环境缺失而跳过；需要使用隔离的测试数据库和本地测试存储目录：

```bash
$env:TEST_DATABASE_URL="postgresql://.../image_library_test?schema=public"
$env:TEST_STORAGE_ROOT="./data/test-storage"
$env:TEST_ADMIN_EMAIL="admin@example.test"
$env:TEST_ADMIN_PASSWORD="..."
$env:DATABASE_URL=$env:TEST_DATABASE_URL
$env:DEV_ADMIN_EMAIL=$env:TEST_ADMIN_EMAIL
$env:DEV_ADMIN_USERNAME="test-admin"
$env:DEV_ADMIN_PASSWORD=$env:TEST_ADMIN_PASSWORD
npm run db:deploy
npm run db:seed
npm run test:integration

$env:E2E_BASE_URL="http://127.0.0.1:3000"
$env:E2E_ADMIN_EMAIL=$env:TEST_ADMIN_EMAIL
$env:E2E_ADMIN_PASSWORD=$env:TEST_ADMIN_PASSWORD
npx playwright install chromium
npm run e2e
```

集成与 E2E 测试必须使用测试数据库，禁止填写生产 `DATABASE_URL`。详见 [docs/deployment.md](docs/deployment.md)。

多人上传承压测试需要先启动隔离测试部署，再运行 `npm run load:uploads`。详见 [docs/load-testing.md](docs/load-testing.md)。
上传或承压测试后可运行 `npm run verify:storage`，只读检查数据库中的有效素材是否都有对应原图、缩略图和预览图。

## 素材库查询 API

所有接口要求已登录且在服务端验证 `read` 权限：

- `GET /api/channels`
- `GET /api/categories?channelId=`
- `GET /api/products?channelId=&categoryId=&spu=&q=&page=&pageSize=`
- `POST /api/products/batch-download` 按所选 SPU 素材库准备 ZIP 下载；随后通过返回的受保护 URL 下载压缩包。
- `GET /api/asset-groups?channelId=&categoryId=&countryCode=&assetType=&page=&pageSize=`
- `GET /api/assets?channelId=&categoryId=&countryCode=&assetType=&color=&spu=&filename=&q=&page=&pageSize=`

素材查询默认返回 24 条，`pageSize` 最大为 100；响应使用统一的 `{ data }` 或 `{ error: { code, message } }` 结构。

## 公告与文档

- 素材库首页会展示当前用户角色可见、状态为 `PUBLISHED`、且处于有效时间范围内的公告。
- 用户可通过 `POST /api/announcements/:announcementId/read` 标记公告已读；后台公告列表会统计已读数量。
- `/docs` 展示当前用户角色可见且状态为 `PUBLISHED` 的文档，并按文档分类分组。
- `visibilityRoles = []` 表示全员可见；指定角色后仅对应角色可见。

## 本地上传与文件访问

- `POST /api/uploads` 接收同一素材组内最多 20 个 JPEG、PNG 或 WEBP 文件，要求 `assetGroupId`、`idempotencyKey` 和与文件顺序对应的元数据。
- `POST /api/uploads/context` 接收渠道、品类、SPU、国家、素材组与图片。服务端会按输入的 SPU 创建或复用商品，并创建或复用对应素材组；新商品的名称默认与 SPU 相同。
- `POST /api/uploads/archive` 接收一个 ZIP 和渠道、品类、SPU、素材组上下文。服务端从 ZIP 路径中的 `德语`、`英语`、`法语`、`意大利语`、`西班牙语` 目录分别识别德国、英国、法国、意大利、西班牙，并为每个识别出的国家创建或复用对应素材组。
- 服务端限制单文件大小为 `MAX_UPLOAD_BYTES`，使用 Sharp 解码确认真实图片格式，计算 SHA-256，并生成 WebP 缩略图和预览图。
- 普通图片上传通过 `UPLOAD_PROCESSING_CONCURRENCY` 限制单个请求内的图片处理并发，避免多人上传时 Sharp 和磁盘 I/O 无界增长。
- ZIP 上传额外受 `MAX_ZIP_UPLOAD_BYTES`、`MAX_ZIP_ENTRIES` 和 `MAX_ZIP_UNCOMPRESSED_BYTES` 限制；不会解压到服务器磁盘。
- 文件先写入 `temporary/`，处理成功后移动到 `originals/`、`thumbnails/`、`previews/`。数据库仅保存相对 `storageKey`，不保存绝对路径。
- 图片通过已登录的 `GET /api/assets/:assetId/content?variant=original|thumbnail|preview` 读取；前端不会获取或拼接本地目录路径。
- `DELETE /api/assets/:assetId` 仅软删除素材记录并写入操作日志，不会删除存储对象。只有后续受控清理任务确认没有任何 `ACTIVE` 素材引用文件对象时，才允许物理删除。

`LOCAL_STORAGE_ROOT` 默认位于 `./data/storage`，已被 Git 忽略。实际上传与 seed 仍需要可用的 PostgreSQL 连接。

## 素材管理

- 素材详情可修改素材类型、排序、颜色、备注，以及所属素材组；每次修改、移动、删除、恢复和下载都会写入操作日志。
- 删除为软删除。`Asset` 与物理 `FileObject` 分离，一个文件对象可被多个有效素材引用；删除任何一个素材都不会删除物理文件。
- 当最后一个有效素材被软删除时，文件对象只会标记为待清理。恢复素材会取消该标记。物理清理必须由后续受控维护任务执行，且仅可处理无 `ACTIVE` 引用的文件对象。
- 单张下载经 `GET /api/assets/:assetId/download` 返回受保护的下载流。批量下载先调用 `POST /api/assets/batch-download` 创建下载批次并获得逐项预检状态，再从受保护 URL 下载 ZIP；ZIP 附带 `manifest.json`。
- 一级素材库页面可下载单个或多个 SPU 素材库，并通过 `POST /api/products/batch-download` 创建素材库下载批次，将所选素材库中的全部有效原图打包为 ZIP。ZIP 内按 `国家/图片类型/其他/文件名` 分目录，其中“其他”来自上传上下文中的其他目录或颜色字段。
- ZIP 下载批次会记录下载人、批次类型、准备时间、实际下载时间、IP、User-Agent、成功/失败数量和每个素材明细；后台下载记录可展开查看。

## 管理后台

`/admin` 仅允许 `SUPER_ADMIN` 访问。当前版本复用现有用户、素材、上传请求和审计日志数据，并新增公告与文档内容表，提供管理视图和基础运营能力：

- 总览看板：素材数、素材库数、活跃用户、今日新增、今日下载、存储占用、待清理文件、已发布公告/文档、角色分布、上传状态、图片类型、品类、渠道、公告状态和文档状态。
- 运营报表：按日期区间统计新增素材、失败文件、上传批次、异常上传批次、下载批次、下载素材数和下载失败项，并展示品类、渠道和下载用户排行；支持 CSV 导出。
- 用户与权限：最近用户、角色、状态、上传数量和审计操作数量，并可新建、编辑、启用/禁用用户和重置密码。
- 下载记录：ZIP 下载批次、下载人、准备/下载时间、IP、User-Agent、成功/失败数量，以及可展开的素材明细；支持按状态、类型、用户和日期筛选、分页与 CSV 导出，同时保留单图与历史审计记录。
- 上传任务：上传批次、上传人、状态、SPU、品类、渠道、国家、图片类型和素材数；支持按状态、用户、SPU、失败项和日期筛选、分页、CSV 导出，展开查看每个文件的状态、错误码、错误信息、其他字段、排序、尺寸和大小，并跳转回素材库或重新上传到对应素材组。
- 素材组治理：按 SPU/名称、品类、缺少国家、缺少图片类型和问题类型筛选素材库，查看国家/图片类型覆盖、缺图项、失败素材和素材组明细，并导出 CSV。
- 质量检查：只读扫描 SPU 命名、素材组字段、文件名规范、派生图缺失、尺寸异常、排序冲突、重复图片复用和处理失败素材；支持按类型、级别、关键词筛选、分页、跳回素材库与 CSV 导出。
- 审计日志：按操作、操作者、对象类型、对象 ID 和日期筛选全量操作日志，支持展开查看详情 JSON、关联素材信息和 CSV 导出。
- 公告管理：支持发布和编辑公告，包含类型、发布状态、角色可见范围、置顶、有效时间和已读统计。
- 文档中心：支持新建和编辑 Markdown 风格使用文档，包含 slug、分类、发布状态、角色可见范围和排序。
- 策略配置：只读展示当前实际生效的上传限制、ZIP 限制、下载规则、角色权限、国家/图片类型、公告/文档内容规则和存储策略；暂不支持在线修改。
- 存储与系统健康：展示当前存储驱动、存储根、读写删除探针、文件对象状态、清理状态、派生图字段缺失、最近活跃文件存在性抽样和待清理文件；支持清理没有 `ACTIVE` 素材引用的待处理文件对象。NAS 驱动接入仍在后续阶段。
- 系统自检：展示应用版本、运行环境、数据库连接、迁移应用情况、活跃超级管理员、存储探针和关键配置检查；仅显示脱敏后的数据库目标与配置状态。
- 部署清单：把首次部署、迁移发布、备份、隔离恢复和发布后验收整理成可勾选 Runbook；勾选状态仅保存在当前浏览器，不执行命令。

用户管理、公告、文档操作和批量下载会写入审计或下载批次记录。相关迁移包括 `20260723003000_admin_user_audit_actions`、`20260723004500_announcements_documents` 和 `20260723011000_download_batches`。部署包含该功能的版本前，需要运行 `npm run db:deploy`。

## 管理后台 API

以下接口仅允许 `SUPER_ADMIN` 使用，响应保持统一 `{ data }` 或 `{ error }` 结构：

- `POST /api/admin/users` 新建用户。
- `PATCH /api/admin/users/:userId` 修改用户资料、角色或状态。
- `POST /api/admin/users/:userId/reset-password` 重置用户密码。
- `GET /api/admin/operations-report/export.csv` 导出当前日期区间的运营趋势报表。
- `GET /api/admin/download-batches/export.csv` 导出当前筛选条件下的 ZIP 下载批次明细。
- `GET /api/admin/upload-tasks/export.csv` 导出当前筛选条件下的上传任务与失败文件明细。
- `GET /api/admin/asset-group-governance/export.csv` 导出当前筛选条件下的素材组覆盖与缺图清单。
- `GET /api/admin/data-quality/export.csv` 导出当前筛选条件下的数据质量问题清单。
- `GET /api/admin/audit-logs/export.csv` 导出当前筛选条件下的审计日志。
- `GET /api/admin/storage/health` 查看通用存储健康、文件对象状态和待清理队列。
- `POST /api/admin/storage/cleanup` 清理没有活动素材引用的待处理文件对象。
- `GET /api/admin/system/status` 查看部署前系统自检、环境配置、迁移和管理员状态。
- `GET /api/admin/announcements` 查看最近公告。
- `POST /api/admin/announcements` 发布公告。
- `PATCH /api/admin/announcements/:announcementId` 编辑公告。
- `GET /api/announcements` 查看当前用户可见公告。
- `POST /api/announcements/:announcementId/read` 标记当前用户公告已读。
- `GET /api/admin/documents` 查看文档列表。
- `POST /api/admin/documents` 新建文档。
- `PATCH /api/admin/documents/:documentId` 编辑文档。

## 计划中的目录

```text
apps/
  web/                 # Next.js Web 应用
packages/
  contracts/           # 前后端共享类型与 API 契约
  storage/             # StorageService 与存储适配器
  ui/                  # 可复用 UI
docs/
var/
  storage/             # 本地开发原文件，不提交
  thumbnails/          # 本地开发缩略图，不提交
```

## 运行文档

- [架构](docs/architecture.md)
- [数据模型](docs/data-model.md)
- [本地存储](docs/storage.md)
- [部署与测试](docs/deployment.md)
- [承压测试](docs/load-testing.md)
- [NAS 接入替换计划](docs/nas-integration-plan.md)
