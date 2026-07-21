"use client";

import { Check, CheckSquare, Expand, Pencil, Square, Trash2 } from "lucide-react";
import type { CSSProperties } from "react";
import type { LibraryAsset } from "@/lib/library/contracts";
import { countryName } from "@/lib/library/countries";

type AssetGridProps = {
  assets: LibraryAsset[];
  columns: 4 | 6 | 8;
  selectedIds: Set<string>;
  onPreview: (asset: LibraryAsset) => void;
  onToggle: (assetId: string) => void;
  canEdit: (asset: LibraryAsset) => boolean;
  canDelete: (asset: LibraryAsset) => boolean;
  onEdit: (asset: LibraryAsset) => void;
  onDelete: (asset: LibraryAsset) => void;
};

export function AssetGrid({ assets, columns, selectedIds, onPreview, onToggle, canEdit, canDelete, onEdit, onDelete }: AssetGridProps) {
  if (assets.length === 0) {
    return <div className="empty-state">没有符合当前筛选条件的素材。</div>;
  }

  return (
    <div className="asset-grid" style={{ "--columns": columns } as CSSProperties}>
      {assets.map((asset) => {
        const selected = selectedIds.has(asset.id);
        return (
          <article className={selected ? "asset-card is-selected" : "asset-card"} key={asset.id}>
            <button className={`asset-preview slot-${asset.previewSlot}`} style={{ backgroundImage: `url("${asset.thumbnailUrl ?? asset.previewUrl ?? "/assets/reference-library.png"}")` }} type="button" onClick={() => onPreview(asset)} aria-label={`预览 ${asset.filename}`}>
              <span className="preview-shade" />
              <span className="preview-action"><Expand aria-hidden="true" /></span>
            </button>
            <button
              className={selected ? "select-button is-selected" : "select-button"}
              type="button"
              aria-pressed={selected}
              aria-label={selected ? `取消选择 ${asset.filename}` : `选择 ${asset.filename}`}
              onClick={() => onToggle(asset.id)}
            >
              {selected ? <CheckSquare aria-hidden="true" /> : <Square aria-hidden="true" />}
            </button>
            {(canEdit(asset) || canDelete(asset)) && <div className="manage-actions">
              {canEdit(asset) && <button type="button" onClick={() => onEdit(asset)} aria-label={`编辑 ${asset.filename}`}><Pencil aria-hidden="true" /></button>}
              {canDelete(asset) && <button type="button" onClick={() => onDelete(asset)} aria-label={`删除 ${asset.filename}`}><Trash2 aria-hidden="true" /></button>}
            </div>}
            <div className="asset-details">
              <div className="asset-tags">
                <span>{countryName(asset.countryCode)}</span>
                <span className="type-tag">{asset.assetType}</span>
                <span>#{String(asset.order).padStart(2, "0")}</span>
              </div>
              <strong>{asset.spu}</strong>
              <p>{countryName(asset.countryCode)} · {asset.color}</p>
              <p className="asset-file">{asset.width} x {asset.height} · {(asset.fileSizeBytes / 1_000_000).toFixed(2)} MB</p>
            </div>
            {selected && <span className="selected-mark"><Check aria-hidden="true" /></span>}
          </article>
        );
      })}
    </div>
  );
}
