"use client";

import { ArrowLeft, FileImage, LoaderCircle, Plus, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ThemeToggle } from "@/components/theme-toggle";
import type { ApiFailure, ApiSuccess, AssetGroupListItem, Paginated } from "@/lib/library/contracts";
import { assetTypeOptions, countryName } from "@/lib/library/countries";

const assetTypes = assetTypeOptions;

type UploadRow = {
  id: string;
  file: File;
  assetType: string;
  sortOrder: number;
  error?: string;
  status?: string;
  progress?: number;
  duplicateOfAssetId?: string | null;
};

type UploadWorkspaceProps = { initialAssetGroupId?: string };

export function UploadWorkspace({ initialAssetGroupId }: UploadWorkspaceProps) {
  const router = useRouter();
  const [groups, setGroups] = useState<AssetGroupListItem[]>([]);
  const [assetGroupId, setAssetGroupId] = useState(initialAssetGroupId ?? "");
  const [rows, setRows] = useState<UploadRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const idempotencyKey = useRef("");
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/asset-groups?page=1&pageSize=100", { signal: controller.signal })
      .then(async (response) => {
        const body = await response.json() as ApiSuccess<Paginated<AssetGroupListItem>> | ApiFailure;
        if (!response.ok || "error" in body) throw new Error("error" in body ? body.error.message : "无法加载素材组。");
        return body.data;
      })
      .then((data) => {
        setGroups(data.items);
        setAssetGroupId((current) => data.items.some((group) => group.id === current) ? current : data.items[0]?.id ?? "");
      })
      .catch((requestError: unknown) => {
        if (!controller.signal.aborted) setError(requestError instanceof Error ? requestError.message : "无法加载素材组。");
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, []);

  const selectedGroup = groups.find((group) => group.id === assetGroupId);

  function addFiles(files: FileList | null) {
    if (!files?.length || !selectedGroup) return;
    idempotencyKey.current = crypto.randomUUID();
    setRows((current) => [
      ...current,
      ...Array.from(files).map((file, index) => ({
        id: crypto.randomUUID(),
        file,
        assetType: selectedGroup.assetType,
        sortOrder: current.length + index + 1,
      })),
    ]);
  }

  function updateRow(id: string, changes: Partial<Pick<UploadRow, "assetType" | "sortOrder">>) {
    setRows((current) => current.map((row) => row.id === id ? { ...row, ...changes } : row));
  }

  async function submit() {
    if (!assetGroupId || !rows.length || submitting) return;
    setSubmitting(true);
    setError("");
    const formData = new FormData();
    formData.set("assetGroupId", assetGroupId);
    formData.set("idempotencyKey", idempotencyKey.current);
    formData.set("metadata", JSON.stringify(rows.map((row) => ({ assetType: row.assetType, sortOrder: row.sortOrder }))));
    rows.forEach((row) => formData.append("files", row.file));
    setRows((current) => current.map((row) => ({ ...row, status: "UPLOADING", error: undefined, progress: 0 })));

    try {
      const result = await sendUpload(formData, (progress) => {
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

  if (loading) return <main className="upload-page"><div className="data-state">正在加载上传上下文…</div></main>;
  if (error && !groups.length) return <main className="upload-page"><div className="data-state is-error" role="alert">{error}</div></main>;

  return (
    <main className="upload-page">
      <section className="upload-panel" aria-labelledby="upload-title">
        <div className="upload-heading">
          <div className="upload-heading-actions">
            <button className="back-button" type="button" onClick={() => router.back()}><ArrowLeft aria-hidden="true" />返回素材库</button>
            <ThemeToggle />
          </div>
          <div><p>本地存储上传</p><h1 id="upload-title">上传静态素材</h1></div>
        </div>
        <label className="upload-context">
          <span>素材组上下文</span>
          <select value={assetGroupId} onChange={(event) => { setAssetGroupId(event.target.value); setRows([]); idempotencyKey.current = crypto.randomUUID(); }} disabled={submitting}>
            {groups.map((group) => <option value={group.id} key={group.id}>{group.channelName} · {group.categoryName} · {group.product.spu} · {countryName(group.countryCode)} · {group.assetType}</option>)}
          </select>
        </label>
        {selectedGroup && <div className="upload-context-summary">渠道：{selectedGroup.channelName}　品类：{selectedGroup.categoryName}　国家：{countryName(selectedGroup.countryCode)}　SPU：{selectedGroup.product.spu}　素材组：{selectedGroup.assetType}</div>}

        <input ref={fileInput} className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => addFiles(event.target.files)} disabled={submitting} />
        <button className="upload-dropzone" type="button" onClick={() => fileInput.current?.click()} disabled={submitting || !selectedGroup}>
          <Plus aria-hidden="true" /><span>选择图片</span><small>JPEG、PNG、WEBP，文件大小由服务端校验</small>
        </button>

        {rows.length > 0 && <div className="upload-list">
          {rows.map((row) => <article key={row.id} className="upload-row">
            <FileImage aria-hidden="true" />
            <div><strong>{row.file.name}</strong><small>{(row.file.size / 1_000_000).toFixed(2)} MB</small>{row.status === "UPLOADING" && <progress value={row.progress ?? 0} max="100">{row.progress ?? 0}%</progress>}{row.status && row.status !== "UPLOADING" && <small>状态：{row.status}</small>}{row.duplicateOfAssetId && <small className="upload-row-warning">检测到相同图片，已复用现有文件对象。</small>}{row.error && <small className="upload-row-error">{row.error}</small>}</div>
            <label><span>素材类型</span><select value={row.assetType} onChange={(event) => updateRow(row.id, { assetType: event.target.value })} disabled={submitting}>{assetTypes.map((assetType) => <option key={assetType}>{assetType}</option>)}</select></label>
            <label><span>排序</span><input type="number" min="1" value={row.sortOrder} onChange={(event) => updateRow(row.id, { sortOrder: Number(event.target.value) || 1 })} disabled={submitting} /></label>
          </article>)}
        </div>}
        {error && <p className="upload-error" role="alert">{error}</p>}
        <button className="upload-submit" type="button" onClick={submit} disabled={submitting || !rows.length || !assetGroupId}>
          {submitting ? <LoaderCircle aria-hidden="true" /> : <Upload aria-hidden="true" />}{submitting ? "处理中" : `上传 ${rows.length} 个文件`}
        </button>
      </section>
    </main>
  );
}

type UploadResponse = { files: Array<{ originalFilename: string; status: string; duplicateOfAssetId: string | null; errorMessage: string | null }> };

function sendUpload(formData: FormData, onProgress: (progress: number) => void): Promise<UploadResponse> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", "/api/uploads");
    request.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    });
    request.addEventListener("error", () => reject(new Error("上传请求失败。")));
    request.addEventListener("load", () => {
      let body: ApiSuccess<UploadResponse> | ApiFailure;
      try {
        body = JSON.parse(request.responseText) as ApiSuccess<UploadResponse> | ApiFailure;
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
