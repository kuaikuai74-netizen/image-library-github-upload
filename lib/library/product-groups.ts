type ProductGroupSource = {
  categoryId: string;
  productId: string;
  assetCount: number;
};

export function summarizeProductGroupsByCategory(groups: ProductGroupSource[]) {
  const totals = new Map<string, { productIds: Set<string>; assetCount: number }>();
  for (const group of groups) {
    if (!group.assetCount) continue;
    const current = totals.get(group.categoryId) ?? { productIds: new Set<string>(), assetCount: 0 };
    current.productIds.add(group.productId);
    totals.set(group.categoryId, { productIds: current.productIds, assetCount: current.assetCount + group.assetCount });
  }
  return new Map([...totals].map(([categoryId, total]) => [categoryId, { assetGroupCount: total.productIds.size, assetCount: total.assetCount }]));
}
