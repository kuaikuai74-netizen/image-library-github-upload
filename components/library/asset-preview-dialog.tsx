"use client";

import { Check, Download, FilePenLine, Save, Trash2, X } from "lucide-react";
import type { CSSProperties } from "react";
import { useEffect, useState } from "react";
import type { AssetGroupListItem, LibraryAsset } from "@/lib/library/contracts";
import { assetTypeOptions, countryName } from "@/lib/library/countries";

const assetTypes = assetTypeOptions;

type EditableFields = { assetType: string; sortOrder: number; color: string; notes: string; assetGroupId: string };

type AssetPreviewDialogProps = {
  asset: LibraryAsset | null;
  groups: AssetGroupListItem[];
  selected: boolean;
  onClose: () => void;
  onToggle: (assetId: string) => void;
  onDownload: (asset: LibraryAsset) => void;
  onSave: (asset: LibraryAsset, changes: EditableFields) => Promise<void>;
  onDelete: (asset: LibraryAsset) => Promise<void>;
  canDownload: boolean;
  canEdit: boolean;
  canDelete: boolean;
};

type LogItem = { id: string; action: string; createdAt: string; actor: { name: string; email: string } | null };

function initialFields(asset: LibraryAsset): EditableFields {
  return { assetType: asset.assetType, sortOrder: asset.order, color: asset.color, notes: asset.notes, assetGroupId: asset.assetGroupId };
}

export function AssetPreviewDialog({ asset, groups, selected, onClose, onToggle, onDownload, onSave, onDelete, canDownload, canEdit, canDelete }: AssetPreviewDialogProps) {
  const [fields, setFields] = useState<EditableFields | null>(() => asset ? initialFields(asset) : null);
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!asset || !canEdit) return;
    const controller = new AbortController();
    fetch(`/api/assets/${asset.id}/logs`, { signal: controller.signal })
      .then(async (response) => {
        const body = await response.json() as { data?: LogItem[]; error?: { message: string } };
        if (!response.ok || !body.data) throw new Error(body.error?.message ?? "无法加载操作日志。");
        return body.data;
      })
      .then(setLogs)
      .catch((requestError: unknown) => { if (!controller.signal.aborted) setError(requestError instanceof Error ? requestError.message : "无法加载操作日志。"); });
    return () => controller.abort();
  }, [asset, canEdit]);

  if (!asset || !fields) return null;
  const currentAsset = asset;
  const currentFields = fields;
  const mediaUrl = asset.previewUrl ?? asset.thumbnailUrl;
  const previewStyle: CSSProperties = {
    backgroundImage: `url("${mediaUrl ?? "/assets/reference-library.png"}")`,
    ...(mediaUrl ? { backgroundPosition: "center", backgroundSize: "contain" } : {}),
  };

  async function save() {
    setSaving(true);
    setError("");
    try {
      await onSave(currentAsset, currentFields);
    } catch (saveError: unknown) {
      setError(saveError instanceof Error ? saveError.message : "保存失败。");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!window.confirm(`确认删除素材“${currentAsset.filename}”？`)) return;
    setSaving(true);
    try {
      await onDelete(currentAsset);
      onClose();
    } catch (deleteError: unknown) {
      setError(deleteError instanceof Error ? deleteError.message : "删除失败。");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="asset-dialog" role="dialog" aria-modal="true" aria-labelledby="preview-title" onMouseDown={(event) => event.stopPropagation()}>
        <div className={`dialog-preview slot-${asset.previewSlot}`} style={previewStyle} aria-label={`${asset.filename} 预览`} />
        <div className="dialog-info">
          <button className="close-dialog" type="button" onClick={onClose} aria-label="关闭详情"><X aria-hidden="true" /></button>
          <p>素材详情</p>
          <h2 id="preview-title">{asset.spu} · {asset.assetType} #{String(asset.order).padStart(2, "0")}</h2>
          <dl>
            <div><dt>国家</dt><dd>{countryName(asset.countryCode)}</dd></div>
            <div><dt>SKU</dt><dd>{asset.sku}</dd></div>
            <div><dt>规格</dt><dd>{asset.width} x {asset.height} · {(asset.fileSizeBytes / 1_000_000).toFixed(2)} MB</dd></div>
            <div><dt>文件名</dt><dd>{asset.filename}</dd></div>
          </dl>
          {canEdit && <div className="asset-editor">
            <label>素材类型<select value={fields.assetType} onChange={(event) => setFields({ ...fields, assetType: event.target.value })}>{assetTypes.map((type) => <option key={type}>{type}</option>)}</select></label>
            <label>排序<input type="number" min="1" value={fields.sortOrder} onChange={(event) => setFields({ ...fields, sortOrder: Number(event.target.value) || 1 })} /></label>
            <label>其他<input value={fields.color} onChange={(event) => setFields({ ...fields, color: event.target.value })} /></label>
            <label>移动到素材组<select value={fields.assetGroupId} onChange={(event) => setFields({ ...fields, assetGroupId: event.target.value })}>{groups.map((group) => <option value={group.id} key={group.id}>{group.channelName} · {group.categoryName} · {group.product.spu} · {countryName(group.countryCode)} · {group.assetType}</option>)}</select></label>
            <label className="asset-editor-notes">备注<textarea value={fields.notes} maxLength={2000} onChange={(event) => setFields({ ...fields, notes: event.target.value })} /></label>
          </div>}
          {canEdit && <section className="asset-log"><strong>操作日志</strong>{logs.length ? logs.map((log) => <p key={log.id}><span>{log.action}</span>{log.actor?.name ?? "系统"} · {new Date(log.createdAt).toLocaleString("zh-CN")}</p>) : <small>暂无操作日志</small>}</section>}
          {error && <p className="dialog-error" role="alert">{error}</p>}
          <div className="dialog-actions">
            <button type="button" onClick={() => onToggle(asset.id)}><Check aria-hidden="true" />{selected ? "取消选择" : "选择素材"}</button>
            {canDownload && <button className="primary" type="button" onClick={() => onDownload(asset)}><Download aria-hidden="true" />下载原图</button>}
            {canEdit && <button type="button" onClick={save} disabled={saving}><Save aria-hidden="true" />保存修改</button>}
            {canDelete && <button className="danger" type="button" onClick={remove} disabled={saving}><Trash2 aria-hidden="true" />移入回收站</button>}
          </div>
          {canEdit && <p className="dialog-note"><FilePenLine aria-hidden="true" />修改和移动会记录操作日志。</p>}
        </div>
      </section>
    </div>
  );
}
