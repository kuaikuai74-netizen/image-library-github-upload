"use client";

import { CheckSquare, ChevronLeft, ChevronRight, Download, LayoutGrid, Square, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AssetGrid } from "@/components/library/asset-grid";
import { AssetPreviewDialog } from "@/components/library/asset-preview-dialog";
import { RecycleBinDialog } from "@/components/library/recycle-bin-dialog";
import { CategoryCards } from "@/components/library/category-cards";
import { ChannelNav } from "@/components/library/channel-nav";
import { FilterBar, type Filters } from "@/components/library/filter-bar";
import { LibraryHeader } from "@/components/library/library-header";
import { hasAssetPermission } from "@/lib/auth/permissions";
import { roleLabels, type LibraryUser } from "@/lib/auth/roles";
import type { ApiFailure, ApiSuccess, AssetFilters, AssetGroupListItem, CategoryListItem, ChannelListItem, LibraryAsset, Paginated } from "@/lib/library/contracts";

type AssetLibraryProps = { currentUser: LibraryUser };

type LibraryData = {
  queryKey: string;
  channels: ChannelListItem[];
  categories: CategoryListItem[];
  filters: AssetFilters;
  assets: Paginated<LibraryAsset>;
  assetGroups: Paginated<AssetGroupListItem>;
  allAssetGroups: Paginated<AssetGroupListItem>;
};

function pageSizeForColumns(columns: 4 | 5 | 6 | 7 | 8) {
  return columns % 2 === 0 ? 24 : columns * 5;
}

async function requestData<T>(url: string, signal: AbortSignal) {
  const response = await fetch(url, { signal, cache: "no-store" });
  const body = await response.json() as ApiSuccess<T> | ApiFailure;
  if (!response.ok || "error" in body) {
    throw new Error("error" in body ? body.error.message : "查询失败，请稍后重试。");
  }
  return body.data;
}

function filtersFromParams(searchParams: URLSearchParams): Filters {
  return {
    country: searchParams.get("countryCode") ?? "all",
    assetType: searchParams.get("assetType") ?? "all",
    color: searchParams.get("color") ?? "all",
    query: searchParams.get("q") ?? "",
  };
}

export function AssetLibrary({ currentUser }: AssetLibraryProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [data, setData] = useState<LibraryData | null>(null);
  const [error, setError] = useState<{ queryKey: string; message: string } | null>(null);
  const [columns, setColumns] = useState<4 | 5 | 6 | 7 | 8>(6);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [previewAsset, setPreviewAsset] = useState<LibraryAsset | null>(null);
  const [notice, setNotice] = useState("");
  const [reloadVersion, setReloadVersion] = useState(0);
  const [recycleBinOpen, setRecycleBinOpen] = useState(false);

  const state = useMemo(() => ({
    channelId: searchParams.get("channelId") ?? "all",
    categoryId: searchParams.get("categoryId") ?? "",
    filters: filtersFromParams(searchParams),
    page: Number(searchParams.get("page") ?? "1") || 1,
  }), [searchParams]);

  const queryString = useMemo(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("pageSize", String(pageSizeForColumns(columns)));
    return params.toString();
  }, [columns, searchParams]);

  const updateUrl = useCallback((changes: Record<string, string | undefined>) => {
    const next = new URLSearchParams(searchParams.toString());
    Object.entries(changes).forEach(([key, value]) => {
      if (!value || value === "all") next.delete(key);
      else next.set(key, value);
    });
    next.delete("pageSize");
    const serialized = next.toString();
    router.replace(serialized ? `${pathname}?${serialized}` : pathname);
  }, [pathname, router, searchParams]);

  useEffect(() => {
    const controller = new AbortController();
    const scopeParams = new URLSearchParams();
    if (state.channelId !== "all") scopeParams.set("channelId", state.channelId);
    if (state.categoryId) scopeParams.set("categoryId", state.categoryId);

    Promise.all([
      requestData<ChannelListItem[]>("/api/channels", controller.signal),
      requestData<CategoryListItem[]>(`/api/categories?${scopeParams.toString()}`, controller.signal),
      requestData<AssetFilters>(`/api/asset-filters?${scopeParams.toString()}`, controller.signal),
      requestData<Paginated<LibraryAsset>>(`/api/assets?${queryString}`, controller.signal),
      requestData<Paginated<AssetGroupListItem>>(`/api/asset-groups?${queryString}`, controller.signal),
      requestData<Paginated<AssetGroupListItem>>("/api/asset-groups?page=1&pageSize=100", controller.signal),
    ])
      .then(([channels, categories, filters, assets, assetGroups, allAssetGroups]) => {
        if (controller.signal.aborted) return;
        setData({ queryKey: queryString, channels, categories, filters, assets, assetGroups, allAssetGroups });
      })
      .catch((requestError: unknown) => {
        if (controller.signal.aborted) return;
        setError({ queryKey: queryString, message: requestError instanceof Error ? requestError.message : "查询失败，请稍后重试。" });
      });

    return () => controller.abort();
  }, [queryString, reloadVersion, state.categoryId, state.channelId]);

  useEffect(() => {
    if (!state.categoryId && data?.categories[0]) updateUrl({ categoryId: data.categories[0].id, page: "1" });
  }, [data?.categories, state.categoryId, updateUrl]);

  function updateFilters(filters: Filters) {
    updateUrl({
      countryCode: filters.country,
      assetType: filters.assetType,
      color: filters.color,
      q: filters.query.trim(),
      page: "1",
    });
  }

  function clearFilters() {
    updateUrl({ countryCode: undefined, assetType: undefined, color: undefined, q: undefined, page: "1" });
  }

  function toggleAsset(assetId: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(assetId)) next.delete(assetId);
      else next.add(assetId);
      return next;
    });
  }

  function showNotice(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 3200);
  }

  async function handleDelete(asset: LibraryAsset) {
    if (!window.confirm(`确认删除素材“${asset.filename}”？`)) return;
    const response = await fetch(`/api/assets/${asset.id}`, { method: "DELETE" });
    const body = await response.json() as ApiSuccess<{ assetId: string }> | ApiFailure;
    if (!response.ok || "error" in body) throw new Error("error" in body ? body.error.message : "删除失败。");
    setSelectedIds((current) => {
      const next = new Set(current);
      next.delete(asset.id);
      return next;
    });
    setPreviewAsset((current) => current?.id === asset.id ? null : current);
    setReloadVersion((current) => current + 1);
    showNotice("素材已移入回收站。");
  }

  async function handleSave(asset: LibraryAsset, changes: { assetType: string; sortOrder: number; color: string; notes: string; assetGroupId: string }) {
    const response = await fetch(`/api/assets/${asset.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(changes) });
    const body = await response.json() as ApiSuccess<unknown> | ApiFailure;
    if (!response.ok || "error" in body) throw new Error("error" in body ? body.error.message : "保存失败。");
    setPreviewAsset(null);
    setReloadVersion((current) => current + 1);
    showNotice("素材信息已保存。");
  }

  async function handleBatchDownload() {
    const response = await fetch("/api/assets/batch-download", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ assetIds: [...selectedIds] }) });
    const body = await response.json() as ApiSuccess<{ items: Array<{ status: "READY" | "FAILED" }>; downloadUrl: string | null }> | ApiFailure;
    if (!response.ok || "error" in body) throw new Error("error" in body ? body.error.message : "批量下载准备失败。");
    const readyCount = body.data.items.filter((item) => item.status === "READY").length;
    const failedCount = body.data.items.length - readyCount;
    showNotice(failedCount ? `${readyCount} 张素材已打包，${failedCount} 张无法下载。` : `${readyCount} 张素材已开始打包下载。`);
    if (body.data.downloadUrl) window.location.assign(body.data.downloadUrl);
  }

  async function handleBatchDelete() {
    if (!selectedIds.size) return;
    if (selectedIds.size > 50) {
      showNotice("一次最多删除 50 张素材，请分批处理。");
      return;
    }
    if (!window.confirm(`确认删除已选 ${selectedIds.size} 张素材？素材将移入回收站。`)) return;
    const response = await fetch("/api/assets/batch-delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ assetIds: [...selectedIds] }) });
    const body = await response.json() as ApiSuccess<{ items: Array<{ assetId: string; status: "DELETED" | "FAILED"; errorCode: string | null }> }> | ApiFailure;
    if (!response.ok || "error" in body) throw new Error("error" in body ? body.error.message : "批量删除失败。");
    const deletedIds = body.data.items.filter((item) => item.status === "DELETED").map((item) => item.assetId);
    const failedCount = body.data.items.length - deletedIds.length;
    setSelectedIds((current) => {
      const next = new Set(current);
      deletedIds.forEach((assetId) => next.delete(assetId));
      return next;
    });
    setPreviewAsset((current) => current && deletedIds.includes(current.id) ? null : current);
    setReloadVersion((current) => current + 1);
    showNotice(failedCount ? `已删除 ${deletedIds.length} 张，${failedCount} 张删除失败。` : `已删除 ${deletedIds.length} 张素材。`);
  }

  const assets = data?.assets.items ?? [];
  const activeError = error?.queryKey === queryString ? error.message : "";
  const loading = data?.queryKey !== queryString && !activeError;
  const initialLoading = !data && loading;
  const selectedInResults = assets.filter((asset) => selectedIds.has(asset.id));
  const canUpload = hasAssetPermission(currentUser.role, "upload", { userId: currentUser.id });
  const canDownload = hasAssetPermission(currentUser.role, "download", { userId: currentUser.id });
  const canManageRecycleBin = currentUser.role !== "VIEWER";
  const activeCategory = data?.categories.find((category) => category.id === state.categoryId);
  const activeChannelName = state.channelId === "all" ? "全部渠道" : data?.channels.find((channel) => channel.id === state.channelId)?.name ?? "渠道";
  const totalAssets = data?.channels.reduce((total, channel) => total + channel.assetCount, 0) ?? 0;

  const toggleAllResults = () => {
    setSelectedIds((current) => {
      const next = new Set(current);
      const allSelected = assets.length > 0 && assets.every((asset) => next.has(asset.id));
      assets.forEach((asset) => allSelected ? next.delete(asset.id) : next.add(asset.id));
      return next;
    });
  };

  function changeColumns(count: 4 | 5 | 6 | 7 | 8) {
    setColumns(count);
    if (state.page !== 1) updateUrl({ page: "1" });
  }

  return (
    <div className="library-app">
      <LibraryHeader
        query={state.filters.query}
        onQueryChange={(query) => updateFilters({ ...state.filters, query })}
        onUpload={() => {
          const assetGroup = data?.assetGroups.items[0];
          router.push(assetGroup ? `/upload?assetGroupId=${assetGroup.id}` : "/upload");
        }}
        currentUser={currentUser}
        roleLabel={roleLabels[currentUser.role]}
        canUpload={canUpload}
      />
      <div className="library-body">
        <ChannelNav channels={data?.channels ?? []} activeChannel={state.channelId} totalCount={totalAssets} onChange={(channelId) => updateUrl({ channelId, categoryId: undefined, countryCode: undefined, assetType: undefined, color: undefined, q: undefined, page: "1" })} />
        <main className="workspace">
          <section className="context-header" aria-labelledby="library-title">
            <p>当前浏览范围</p>
            <div>
              <h1 id="library-title">{activeCategory?.name ?? "加载品类"} · {activeChannelName}</h1>
              <span>{data?.assets.total ?? 0} 张筛选素材 · {data?.assetGroups.total ?? 0} 个素材组</span>
            </div>
          </section>

          {initialLoading && <div className="data-state">正在加载数据库素材…</div>}
          {!initialLoading && activeError && <div className="data-state is-error" role="alert">{activeError}</div>}
          {!activeError && data && <>
            <CategoryCards categories={data.categories} activeCategory={state.categoryId} onChange={(categoryId) => updateUrl({ categoryId, countryCode: undefined, assetType: undefined, color: undefined, q: undefined, page: "1" })} />
            <FilterBar filters={state.filters} colors={data.filters.colors} onChange={updateFilters} onClear={clearFilters} />
            <section className="page-section" aria-labelledby="assets-heading">
              <div className="asset-toolbar">
                <div>
                  <p>素材结果</p>
                  <h2 id="assets-heading">筛选到 {data.assets.total} 张素材</h2>
                </div>
                <div className="asset-actions">
                  <button className="quiet-button" type="button" onClick={toggleAllResults} disabled={assets.length === 0}>
                    {selectedInResults.length === assets.length && assets.length > 0 ? <CheckSquare aria-hidden="true" /> : <Square aria-hidden="true" />}
                    {selectedInResults.length === assets.length && assets.length > 0 ? "取消全选" : "全选当前页"}
                  </button>
                  {canDownload && <button className="quiet-button" type="button" onClick={() => { void handleBatchDownload().catch((downloadError: unknown) => showNotice(downloadError instanceof Error ? downloadError.message : "批量下载失败。")); }} disabled={selectedIds.size === 0}><Download aria-hidden="true" />下载已选 {selectedIds.size} 张</button>}
                  {canManageRecycleBin && <button className="quiet-button danger-button" type="button" onClick={() => { void handleBatchDelete().catch((deleteError: unknown) => showNotice(deleteError instanceof Error ? deleteError.message : "批量删除失败。")); }} disabled={selectedIds.size === 0}><Trash2 aria-hidden="true" />全部删除</button>}
                  {canManageRecycleBin && <button className="quiet-button" type="button" onClick={() => setRecycleBinOpen(true)}><Trash2 aria-hidden="true" />回收站</button>}
                  <div className="column-switcher" aria-label="图片网格列数">
                    <LayoutGrid aria-hidden="true" />
                    {([4, 5, 6, 7, 8] as const).map((count) => <button key={count} type="button" aria-pressed={columns === count} onClick={() => changeColumns(count)}>{count}</button>)}
                  </div>
                </div>
              </div>
              <AssetGrid assets={assets} columns={columns} selectedIds={selectedIds} onPreview={setPreviewAsset} onToggle={toggleAsset} canEdit={(asset) => hasAssetPermission(currentUser.role, "edit", { userId: currentUser.id, uploadedById: asset.uploadedById ?? undefined })} canDelete={(asset) => hasAssetPermission(currentUser.role, "delete", { userId: currentUser.id, uploadedById: asset.uploadedById ?? undefined })} onEdit={setPreviewAsset} onDelete={(asset) => { void handleDelete(asset).catch((deleteError: unknown) => showNotice(deleteError instanceof Error ? deleteError.message : "删除失败。")); }} />
              {data.assets.totalPages > 1 && <nav className="pagination" aria-label="素材分页">
                <button type="button" disabled={data.assets.page <= 1} onClick={() => updateUrl({ page: String(data.assets.page - 1) })}><ChevronLeft aria-hidden="true" />上一页</button>
                <span>第 {data.assets.page} / {data.assets.totalPages} 页</span>
                <button type="button" disabled={data.assets.page >= data.assets.totalPages} onClick={() => updateUrl({ page: String(data.assets.page + 1) })}>下一页<ChevronRight aria-hidden="true" /></button>
              </nav>}
            </section>
          </>}
        </main>
      </div>
      {notice && <div className="notice" role="status">{notice}</div>}
      <AssetPreviewDialog key={previewAsset?.id ?? "empty"} asset={previewAsset} groups={data?.allAssetGroups.items ?? []} selected={previewAsset ? selectedIds.has(previewAsset.id) : false} onClose={() => setPreviewAsset(null)} onToggle={toggleAsset} onDownload={(asset) => window.location.assign(`/api/assets/${asset.id}/download`)} onSave={handleSave} onDelete={handleDelete} canDownload={canDownload} canEdit={previewAsset ? hasAssetPermission(currentUser.role, "edit", { userId: currentUser.id, uploadedById: previewAsset.uploadedById ?? undefined }) : false} canDelete={previewAsset ? hasAssetPermission(currentUser.role, "delete", { userId: currentUser.id, uploadedById: previewAsset.uploadedById ?? undefined }) : false} />
      <RecycleBinDialog key={recycleBinOpen ? "open" : "closed"} open={recycleBinOpen} onClose={() => setRecycleBinOpen(false)} onRestored={() => { setReloadVersion((current) => current + 1); showNotice("素材已恢复。"); }} />
    </div>
  );
}
