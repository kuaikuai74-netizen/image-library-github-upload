"use client";

import { ArrowLeft, FileImage, LoaderCircle, Plus, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ThemeToggle } from "@/components/theme-toggle";
import type { ApiFailure, ApiSuccess, AssetGroupListItem, CategoryListItem, ChannelListItem, Paginated } from "@/lib/library/contracts";
import { assetTypeOptions, countryName, countryOptions } from "@/lib/library/countries";

type UploadRow = {
  id: string;
  file: File;
  sortOrder: number;
  error?: string;
  status?: string;
  progress?: number;
  duplicateOfAssetId?: string | null;
};

type UploadMode = "images" | "archive";
type UploadWorkspaceProps = { initialAssetGroupId?: string };
type UploadContext = { channelId: string; categoryId: string; spu: string; countryCode: string; assetType: string; other: string };
type ArchiveUploadResponse = {
  countries: Array<{
    countryCode: string;
    assetGroupId: string | null;
    total: number;
    uploaded: number;
    failed: number;
    status: "COMPLETED" | "PARTIAL" | "FAILED";
    message: string | null;
    failures: Array<{ filename: string; message: string }>;
  }>;
  skippedEntries: Array<{ path: string; reason: string }>;
};

const emptyUploadContext: UploadContext = { channelId: "", categoryId: "", spu: "", countryCode: "", assetType: "", other: "" };

export function UploadWorkspace({ initialAssetGroupId }: UploadWorkspaceProps) {
  const router = useRouter();
  const [channels, setChannels] = useState<ChannelListItem[]>([]);
  const [categories, setCategories] = useState<CategoryListItem[]>([]);
  const [context, setContext] = useState<UploadContext>(emptyUploadContext);
  const [uploadMode, setUploadMode] = useState<UploadMode>("images");
  const [rows, setRows] = useState<UploadRow[]>([]);
  const [archiveFile, setArchiveFile] = useState<File | null>(null);
  const [archiveResult, setArchiveResult] = useState<ArchiveUploadResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const idempotencyKey = useRef("");
  const fileInput = useRef<HTMLInputElement>(null);
  const archiveInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      fetchData<Paginated<AssetGroupListItem>>("/api/asset-groups?page=1&pageSize=100", controller.signal),
      fetchData<ChannelListItem[]>("/api/channels", controller.signal),
      fetchData<CategoryListItem[]>("/api/categories", controller.signal),
    ])
      .then(([groupData, channelData, categoryData]) => {
        setChannels(channelData);
        setCategories(categoryData);
        setContext((current) => {
          if (hasDirectContext(current)) return current;
          const initialGroup = groupData.items.find((group) => group.id === initialAssetGroupId) ?? groupData.items[0];
          return initialGroup ? contextFromGroup(initialGroup) : current;
        });
      })
      .catch((requestError: unknown) => {
        if (!controller.signal.aborted) setLoadError(requestError instanceof Error ? requestError.message : "无法加载素材组。");
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [initialAssetGroupId]);

  const hasCompleteContext = hasDirectContext(context);
  const hasArchiveContext = Boolean(context.channelId && context.categoryId && context.spu.trim() && context.assetType);

  function resetSelection() {
    setRows([]);
    setArchiveFile(null);
    setArchiveResult(null);
    idempotencyKey.current = crypto.randomUUID();
    setError("");
    if (archiveInput.current) archiveInput.current.value = "";
  }

  function updateContext(changes: Partial<UploadContext>) {
    setContext((current) => ({ ...current, ...changes }));
    resetSelection();
  }

  function changeUploadMode(mode: UploadMode) {
    if (mode === uploadMode) return;
    setUploadMode(mode);
    resetSelection();
  }

  function addFiles(files: FileList | null) {
    if (!files?.length || !hasCompleteContext) return;
    idempotencyKey.current = crypto.randomUUID();
    setRows((current) => [
      ...current,
      ...Array.from(files).map((file, index) => ({
        id: crypto.randomUUID(),
        file,
        sortOrder: current.length + index + 1,
      })),
    ]);
  }

  function selectArchive(files: FileList | null) {
    const archive = files?.item(0) ?? null;
    if (!archive) return;
    setArchiveFile(archive);
    setArchiveResult(null);
    setError("");
    idempotencyKey.current = crypto.randomUUID();
  }

  function updateRow(id: string, changes: Pick<UploadRow, "sortOrder">) {
    setRows((current) => current.map((row) => row.id === id ? { ...row, ...changes } : row));
  }

  async function submitImages() {
    if (!hasCompleteContext || !rows.length || submitting) return;
    setSubmitting(true);
    setError("");
    const formData = new FormData();
    formData.set("channelId", context.channelId);
    formData.set("categoryId", context.categoryId);
    formData.set("spu", context.spu.trim());
    formData.set("countryCode", context.countryCode);
    formData.set("assetType", context.assetType);
    formData.set("idempotencyKey", idempotencyKey.current);
    formData.set("metadata", JSON.stringify(rows.map((row) => ({ assetType: context.assetType, color: context.other.trim() || undefined, sortOrder: row.sortOrder }))));
    rows.forEach((row) => formData.append("files", row.file));
    setRows((current) => current.map((row) => ({ ...row, status: "UPLOADING", error: undefined, progress: 0 })));

    try {
      const result = await sendFormData<UploadResponse>("/api/uploads/context", formData, (progress) => {
        setRows((current) => current.map((row) => ({ ...row, progress })));
      });
      setRows((current) => current.map((row, index) => ({ ...row, status: result.files[index]?.status, error: result.files[index]?.errorMessage ?? undefined, duplicateOfAssetId: result.files[index]?.duplicateOfAssetId ?? null, progress: 100 })));
      idempotencyKey.current = crypto.randomUUID();
    } catch (uploadError: unknown) {
      setError(uploadError instanceof Error ? uploadError.message : "上传失败。");
    } finally {
      setSubmitting(false);
    }
  }

  async function submitArchive() {
    if (!archiveFile || !hasArchiveContext || submitting) return;
    setSubmitting(true);
    setError("");
    setArchiveResult(null);
    const formData = new FormData();
    formData.set("channelId", context.channelId);
    formData.set("categoryId", context.categoryId);
    formData.set("spu", context.spu.trim());
    formData.set("assetType", context.assetType);
    formData.set("idempotencyKey", idempotencyKey.current);
    formData.set("archive", archiveFile);

    try {
      const result = await sendFormData<ArchiveUploadResponse>("/api/uploads/archive", formData, () => undefined);
      setArchiveResult(result);
      idempotencyKey.current = crypto.randomUUID();
    } catch (uploadError: unknown) {
      setError(uploadError instanceof Error ? uploadError.message : "ZIP 上传失败。");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <main className="upload-page"><div className="data-state">正在加载上传上下文…</div></main>;
  if (loadError) return <main className="upload-page"><div className="data-state is-error" role="alert">{loadError}</div></main>;

  const archiveReady = hasArchiveContext && archiveFile;
  const imageReady = hasCompleteContext && rows.length > 0;

  return (
    <main className="upload-page">
      <section className="upload-panel" aria-labelledby="upload-title">
        <div className="upload-heading">
          <div className="upload-heading-actions">
            <button className="back-button" type="button" onClick={() => router.push("/")}><ArrowLeft aria-hidden="true" />返回素材库</button>
            <ThemeToggle />
          </div>
          <div><p>本地存储上传</p><h1 id="upload-title">上传静态素材</h1></div>
        </div>

        <div className="upload-mode" role="group" aria-label="上传方式">
          <button type="button" aria-pressed={uploadMode === "images"} onClick={() => changeUploadMode("images")} disabled={submitting}>单国图片</button>
          <button type="button" aria-pressed={uploadMode === "archive"} onClick={() => changeUploadMode("archive")} disabled={submitting}>ZIP 自动分国</button>
        </div>

        <div className="upload-context" aria-label="素材组上下文">
          <label><span>渠道</span><select value={context.channelId} onChange={(event) => updateContext({ channelId: event.target.value })} disabled={submitting}>
            <option value="">请选择渠道</option>
            {channels.map((channel) => <option value={channel.id} key={channel.id}>{channel.name}</option>)}
          </select></label>
          <label><span>品类</span><select value={context.categoryId} onChange={(event) => updateContext({ categoryId: event.target.value })} disabled={submitting}>
            <option value="">请选择品类</option>
            {categories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}
          </select></label>
          <label><span>SPU</span><input type="text" value={context.spu} onChange={(event) => updateContext({ spu: event.target.value })} placeholder="输入 SPU" autoComplete="off" disabled={submitting} /></label>
          <label><span>国家</span>{uploadMode === "archive"
            ? <span className="upload-country-auto">ZIP 自动识别</span>
            : <select value={context.countryCode} onChange={(event) => updateContext({ countryCode: event.target.value })} disabled={submitting}>
                <option value="">请选择国家</option>
                {countryOptions.map((country) => <option value={country.code} key={country.code}>{country.name}</option>)}
              </select>}
          </label>
          <label><span>素材组</span><select value={context.assetType} onChange={(event) => updateContext({ assetType: event.target.value })} disabled={submitting}>
            <option value="">请选择素材组</option>
            {assetTypeOptions.map((assetType) => <option value={assetType} key={assetType}>{assetType}</option>)}
          </select></label>
          <label><span>其他</span>{uploadMode === "archive"
            ? <span className="upload-country-auto">ZIP 自动识别</span>
            : <input type="text" value={context.other} onChange={(event) => updateContext({ other: event.target.value })} placeholder="如白色、英标、欧标" autoComplete="off" disabled={submitting} />}
          </label>
        </div>

        <div className="upload-context-summary" aria-live="polite">
          {uploadMode === "archive"
            ? "ZIP 将按语言目录自动识别国家，并读取国家目录后的颜色、英标或欧标等“其他”目录。"
            : hasCompleteContext
              ? <>上传时将自动创建或复用素材组：国家：{countryName(context.countryCode)}　SPU：{context.spu.trim()}　素材组：{context.assetType}　其他：{context.other.trim() || "未指定"}</>
              : "请选择渠道、品类、国家和素材组，并输入 SPU。"}
        </div>

        {uploadMode === "images" ? <>
          <input ref={fileInput} className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => addFiles(event.target.files)} disabled={submitting} />
          <button className="upload-dropzone" type="button" onClick={() => fileInput.current?.click()} disabled={submitting || !hasCompleteContext}>
            <Plus aria-hidden="true" /><span>选择图片</span><small>JPEG、PNG、WEBP，文件大小由服务端校验</small>
          </button>

          {rows.length > 0 && <div className="upload-list">
            {rows.map((row) => <article key={row.id} className="upload-row">
              <FileImage aria-hidden="true" />
              <div><strong>{row.file.name}</strong><small>{formatFileSize(row.file.size)}</small>{row.status === "UPLOADING" && <progress value={row.progress ?? 0} max="100">{row.progress ?? 0}%</progress>}{row.status && row.status !== "UPLOADING" && <small>状态：{row.status}</small>}{row.duplicateOfAssetId && <small className="upload-row-warning">检测到相同图片，已复用现有文件对象。</small>}{row.error && <small className="upload-row-error">{row.error}</small>}</div>
              <label><span>排序</span><input type="number" min="1" value={row.sortOrder} onChange={(event) => updateRow(row.id, { sortOrder: Number(event.target.value) || 1 })} disabled={submitting} /></label>
            </article>)}
          </div>}
        </> : <>
          <input ref={archiveInput} className="sr-only" type="file" accept=".zip,application/zip,application/x-zip-compressed" onChange={(event) => selectArchive(event.target.files)} disabled={submitting} />
          <button className="upload-dropzone" type="button" onClick={() => archiveInput.current?.click()} disabled={submitting || !hasArchiveContext}>
            <Plus aria-hidden="true" /><span>{archiveFile ? archiveFile.name : "选择 ZIP 压缩包"}</span><small>{archiveFile ? formatFileSize(archiveFile.size) : "语言目录匹配国家，后续目录写入其他"}</small>
          </button>
          {archiveResult && <ArchiveUploadResult result={archiveResult} />}
        </>}

        {error && <p className="upload-error" role="alert">{error}</p>}
        <button className="upload-submit" type="button" onClick={uploadMode === "archive" ? submitArchive : submitImages} disabled={submitting || (uploadMode === "archive" ? !archiveReady : !imageReady)}>
          {submitting ? <LoaderCircle aria-hidden="true" /> : <Upload aria-hidden="true" />}{submitting ? "处理中" : uploadMode === "archive" ? "上传 ZIP 压缩包" : `上传 ${rows.length} 个文件`}
        </button>
      </section>
    </main>
  );
}

function ArchiveUploadResult({ result }: { result: ArchiveUploadResponse }) {
  return <section className="archive-result" aria-live="polite">
    <strong>ZIP 上传结果</strong>
    <div>
      {result.countries.map((country) => <article key={country.countryCode}>
        <span>{countryName(country.countryCode)}</span>
        <small>成功 {country.uploaded} / {country.total}</small>
        <small className={country.status === "COMPLETED" ? "archive-status-success" : "archive-status-warning"}>{country.message ?? "已完成"}</small>
      </article>)}
    </div>
    {result.skippedEntries.length > 0 && <small>已忽略 {result.skippedEntries.length} 个非图片或未识别文件。</small>}
  </section>;
}

type UploadResponse = { files: Array<{ originalFilename: string; status: string; duplicateOfAssetId: string | null; errorMessage: string | null }> };

function contextFromGroup(group: AssetGroupListItem): UploadContext {
  return { channelId: group.channelId, categoryId: group.categoryId, spu: group.product.spu, countryCode: group.countryCode, assetType: group.assetType, other: "" };
}

function hasDirectContext(context: UploadContext) {
  return Boolean(context.channelId && context.categoryId && context.spu.trim() && context.countryCode && context.assetType);
}

function formatFileSize(bytes: number) {
  return `${(bytes / 1_000_000).toFixed(2)} MB`;
}

async function fetchData<T>(url: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal });
  const body = await response.json() as ApiSuccess<T> | ApiFailure;
  if (!response.ok || "error" in body) throw new Error("error" in body ? body.error.message : "无法加载上传上下文。");
  return body.data;
}

function sendFormData<T>(url: string, formData: FormData, onProgress: (progress: number) => void): Promise<T> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", url);
    request.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    });
    request.addEventListener("error", () => reject(new Error("上传请求失败。")));
    request.addEventListener("load", () => {
      let body: ApiSuccess<T> | ApiFailure;
      try {
        body = JSON.parse(request.responseText) as ApiSuccess<T> | ApiFailure;
      } catch {
        reject(new Error("上传服务返回了无效响应。"));
        return;
      }
      if (request.status < 200 || request.status >= 300 || "error" in body) {
        reject(new Error("error" in body ? body.error.message : "上传失败。"));
        return;
      }
      resolve(body.data);
    });
    request.send(formData);
  });
}
