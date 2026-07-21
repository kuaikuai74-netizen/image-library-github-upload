"use client";

import { LoaderCircle, RotateCcw, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { ApiFailure, ApiSuccess, Paginated } from "@/lib/library/contracts";

type RecycleAsset = { id: string; filename: string; assetType: string; color: string; deletedAt: string | null; fileObject: { cleanupStatus: string }; assetGroup: { product: { spu: string } } };

type RecycleBinDialogProps = { open: boolean; onClose: () => void; onRestored: () => void };

export function RecycleBinDialog({ open, onClose, onRestored }: RecycleBinDialogProps) {
  const [items, setItems] = useState<RecycleAsset[]>([]);
  const [loading, setLoading] = useState(open);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    fetch("/api/recycle-bin?page=1&pageSize=50", { signal: controller.signal })
      .then(async (response) => {
        const body = await response.json() as ApiSuccess<Paginated<RecycleAsset>> | ApiFailure;
        if (!response.ok || "error" in body) throw new Error("error" in body ? body.error.message : "无法加载回收站。");
        return body.data.items;
      })
      .then(setItems)
      .catch((requestError: unknown) => { if (!controller.signal.aborted) setError(requestError instanceof Error ? requestError.message : "无法加载回收站。"); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [open]);

  async function restore(assetId: string) {
    setError("");
    try {
      const response = await fetch(`/api/assets/${assetId}/restore`, { method: "POST" });
      const body = await response.json() as ApiSuccess<unknown> | ApiFailure;
      if (!response.ok || "error" in body) throw new Error("error" in body ? body.error.message : "恢复失败。");
      setItems((current) => current.filter((item) => item.id !== assetId));
      onRestored();
    } catch (restoreError: unknown) {
      setError(restoreError instanceof Error ? restoreError.message : "恢复失败。");
    }
  }

  if (!open) return null;
  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="recycle-dialog" role="dialog" aria-modal="true" aria-labelledby="recycle-title" onMouseDown={(event) => event.stopPropagation()}>
        <header><div><p>已软删除素材</p><h2 id="recycle-title">回收站</h2></div><button className="close-dialog" type="button" onClick={onClose} aria-label="关闭回收站"><X aria-hidden="true" /></button></header>
        {loading && <div className="recycle-state"><LoaderCircle aria-hidden="true" />正在加载…</div>}
        {!loading && error && <p className="dialog-error" role="alert">{error}</p>}
        {!loading && !error && !items.length && <div className="recycle-state"><Trash2 aria-hidden="true" />回收站为空</div>}
        {!loading && items.length > 0 && <div className="recycle-list">{items.map((asset) => <article key={asset.id}><div><strong>{asset.filename}</strong><small>{asset.assetGroup.product.spu} · {asset.assetType} · {asset.color}</small><small>删除时间：{asset.deletedAt ? new Date(asset.deletedAt).toLocaleString("zh-CN") : "未知"}</small>{asset.fileObject.cleanupStatus === "PENDING" && <small className="warning">文件已进入待清理队列，恢复将取消清理。</small>}</div><button type="button" onClick={() => restore(asset.id)}><RotateCcw aria-hidden="true" />恢复</button></article>)}</div>}
      </section>
    </div>
  );
}
