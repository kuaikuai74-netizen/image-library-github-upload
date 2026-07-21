# 跨境电商视觉资产

用于集中管理电商静态图片素材的企业系统。目标能力包括渠道、品类、素材组、国家、图片类型、颜色、SPU 搜索、预览、批量选择、上传、下载、登录与权限管理。

## 当前状态

阶段一已增加 Next.js + TypeScript 静态素材库页面。旧 `index.html` 仍保留为设计原型；新页面使用集中 mock 数据实现筛选、选择、预览和响应式布局，不包含真实后端、数据库、登录或持久化文件存储。

当前阶段已具备账号密码登录、角色权限基础、Prisma 素材数据模型和数据库查询 API。页面筛选、统计和分页从数据库读取；上传通过服务端 `StorageService` 写入本地目录，并生成缩略图和预览图。暂不接入绿联 NAS。

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
npm run db:generate
npm run dev
```

访问 `http://localhost:3000` 登录并查看素材库。`index.html` 只用于查看历史设计原型。

## 环境变量

正式应用初始化后，从 `.env.example` 创建本地 `.env`。不要提交 `.env`、真实密钥、数据库密码或 NAS 凭据。

登录开发环境前，需要配置 PostgreSQL 和本地 `.env`，然后执行：

```bash
npm run db:migrate
npm run db:seed
```

seed 使用 `DEV_ADMIN_EMAIL`、`DEV_ADMIN_USERNAME` 和 `DEV_ADMIN_PASSWORD` 创建或更新 `SUPER_ADMIN` 账号；不会在仓库中保存明文密码。

## 测试与质量检查

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

`npm run test` 仅运行不依赖外部服务的单元测试。它覆盖权限、存储键生成、本地存储、真实图片解码验证、排序约定和重复文件复用判断。

集成测试和 E2E 不会因环境缺失而跳过；需要使用隔离的测试数据库和本地测试存储目录：

```bash
$env:TEST_DATABASE_URL="postgresql://.../image_library_test?schema=public"
$env:TEST_STORAGE_ROOT="./data/test-storage"
$env:TEST_ADMIN_EMAIL="admin@example.test"
$env:TEST_ADMIN_PASSWORD="..."
npm run db:migrate
npm run db:seed
npm run test:integration

$env:E2E_BASE_URL="http://127.0.0.1:3000"
$env:E2E_ADMIN_EMAIL=$env:TEST_ADMIN_EMAIL
$env:E2E_ADMIN_PASSWORD=$env:TEST_ADMIN_PASSWORD
npx playwright install chromium
npm run e2e
```

集成与 E2E 测试必须使用测试数据库，禁止填写生产 `DATABASE_URL`。详见 [docs/deployment.md](docs/deployment.md)。

## 素材库查询 API

所有接口要求已登录且在服务端验证 `read` 权限：

- `GET /api/channels`
- `GET /api/categories?channelId=`
- `GET /api/products?categoryId=&spu=&page=&pageSize=`
- `GET /api/asset-groups?channelId=&categoryId=&countryCode=&assetType=&page=&pageSize=`
- `GET /api/assets?channelId=&categoryId=&countryCode=&assetType=&color=&spu=&filename=&q=&page=&pageSize=`

素材查询默认返回 24 条，`pageSize` 最大为 100；响应使用统一的 `{ data }` 或 `{ error: { code, message } }` 结构。

## 本地上传与文件访问

- `POST /api/uploads` 接收同一素材组内最多 20 个 JPEG、PNG 或 WEBP 文件，要求 `assetGroupId`、`idempotencyKey` 和与文件顺序对应的元数据。
- 服务端限制单文件大小为 `MAX_UPLOAD_BYTES`，使用 Sharp 解码确认真实图片格式，计算 SHA-256，并生成 WebP 缩略图和预览图。
- 文件先写入 `temporary/`，处理成功后移动到 `originals/`、`thumbnails/`、`previews/`。数据库仅保存相对 `storageKey`，不保存绝对路径。
- 图片通过已登录的 `GET /api/assets/:assetId/content?variant=original|thumbnail|preview` 读取；前端不会获取或拼接本地目录路径。
- `DELETE /api/assets/:assetId` 仅软删除素材记录并写入操作日志，不会删除存储对象。只有后续受控清理任务确认没有任何 `ACTIVE` 素材引用文件对象时，才允许物理删除。

`LOCAL_STORAGE_ROOT` 默认位于 `./data/storage`，已被 Git 忽略。实际上传与 seed 仍需要可用的 PostgreSQL 连接。

## 素材管理

- 素材详情可修改素材类型、排序、颜色、备注，以及所属素材组；每次修改、移动、删除、恢复和下载都会写入操作日志。
- 删除为软删除。`Asset` 与物理 `FileObject` 分离，一个文件对象可被多个有效素材引用；删除任何一个素材都不会删除物理文件。
- 当最后一个有效素材被软删除时，文件对象只会标记为待清理。恢复素材会取消该标记。物理清理必须由后续受控维护任务执行，且仅可处理无 `ACTIVE` 引用的文件对象。
- 单张下载经 `GET /api/assets/:assetId/download` 返回受保护的下载流。批量下载先调用 `POST /api/assets/batch-download` 获得逐项状态，再从受保护 URL 下载 ZIP；ZIP 附带 `manifest.json`。

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
- [NAS 接入替换计划](docs/nas-integration-plan.md)
