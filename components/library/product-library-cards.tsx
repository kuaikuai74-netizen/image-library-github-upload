"use client";

import { ArrowLeft, CheckSquare, ChevronRight, Download, Images, Square } from "lucide-react";
import type { ProductListItem } from "@/lib/library/contracts";

type ProductLibraryCardsProps = {
  products: ProductListItem[];
  activeSpu: string;
  selectedProductIds: Set<string>;
  canDownload: boolean;
  downloading: boolean;
  onOpen: (spu: string) => void;
  onBack: () => void;
  onToggle: (productId: string) => void;
  onToggleAll: () => void;
  onDownloadSelected: () => void;
  onDownloadProduct: (productId: string) => void;
};

export function ProductLibraryCards({ products, activeSpu, selectedProductIds, canDownload, downloading, onOpen, onBack, onToggle, onToggleAll, onDownloadSelected, onDownloadProduct }: ProductLibraryCardsProps) {
  const activeProduct = products.find((product) => product.spu === activeSpu);
  const selectedCount = products.filter((product) => selectedProductIds.has(product.id)).length;
  const selectedAssetCount = products.reduce((sum, product) => selectedProductIds.has(product.id) ? sum + product.assetCount : sum, 0);
  const allSelected = products.length > 0 && products.every((product) => selectedProductIds.has(product.id));

  return (
    <section className="page-section" aria-labelledby="product-library-heading">
      <div className="section-heading">
        <div>
          <p>素材库</p>
          <h2 id="product-library-heading">{activeProduct ? activeProduct.spu : "选择素材库"}</h2>
        </div>
        {activeProduct
          ? <button className="quiet-button" type="button" onClick={onBack}><ArrowLeft aria-hidden="true" />返回素材库</button>
          : <span>{products.length} 个素材库</span>}
      </div>
      {!activeProduct && products.length > 0 && <div className="product-library-actions" aria-label="素材库批量操作">
        <button className="quiet-button" type="button" onClick={onToggleAll} disabled={products.length === 0}>
          {allSelected ? <CheckSquare aria-hidden="true" /> : <Square aria-hidden="true" />}
          {allSelected ? "取消全选" : "全选当前页"}
        </button>
        {canDownload && <button className="quiet-button" type="button" onClick={onDownloadSelected} disabled={downloading || selectedCount === 0}>
          <Download aria-hidden="true" />{downloading ? "准备压缩包" : `下载已选 ${selectedAssetCount} 张`}
        </button>}
      </div>}
      {!activeProduct && products.length === 0 && <div className="empty-state">当前品类下暂无素材库。</div>}
      {!activeProduct && products.length > 0 && <div className="product-library-grid">
        {products.map((product) => {
          const selected = selectedProductIds.has(product.id);
          return (
            <article className={selected ? "product-library-card is-selected" : "product-library-card"} key={product.id}>
              <button className={selected ? "product-library-select is-selected" : "product-library-select"} type="button" aria-pressed={selected} aria-label={selected ? `取消选择素材库 ${product.spu}` : `选择素材库 ${product.spu}`} onClick={() => onToggle(product.id)}>
                {selected ? <CheckSquare aria-hidden="true" /> : <Square aria-hidden="true" />}
              </button>
              <button className="product-library-open" type="button" onClick={() => onOpen(product.spu)}>
                <span
                  className={`product-library-thumb slot-${product.previewSlot}`}
                  style={product.thumbnailUrl ? { backgroundImage: `url("${product.thumbnailUrl}")`, backgroundPosition: "center", backgroundSize: "cover" } : undefined}
                  aria-hidden="true"
                />
                <span>
                  <strong>{product.spu}</strong>
                  <small>{product.name === product.spu ? `${product.assetCount} 张素材` : `${product.name} · ${product.assetCount} 张素材`}</small>
                </span>
                <ChevronRight aria-hidden="true" />
              </button>
              {selected && canDownload && <button className="product-library-download" type="button" onClick={() => onDownloadProduct(product.id)} disabled={downloading || product.assetCount === 0}>
                <Download aria-hidden="true" />下载全部素材
              </button>}
            </article>
          );
        })}
      </div>}
      {activeProduct && <div className="product-library-active">
        <span
          className={`product-library-thumb slot-${activeProduct.previewSlot}`}
          style={activeProduct.thumbnailUrl ? { backgroundImage: `url("${activeProduct.thumbnailUrl}")`, backgroundPosition: "center", backgroundSize: "cover" } : undefined}
          aria-hidden="true"
        />
        <div>
          <strong>{activeProduct.name === activeProduct.spu ? activeProduct.spu : activeProduct.name}</strong>
          <small>{activeProduct.assetCount} 张素材</small>
        </div>
        <Images aria-hidden="true" />
      </div>}
    </section>
  );
}
