import { describe, expect, it } from "vitest";
import { summarizeProductGroupsByCategory } from "../lib/library/product-groups";

describe("business asset group totals", () => {
  it("counts one SPU as one asset group across countries and image types", () => {
    const totals = summarizeProductGroupsByCategory([
      { categoryId: "category-casegoods", productId: "product-0501", assetCount: 32 },
      { categoryId: "category-casegoods", productId: "product-0501", assetCount: 32 },
      { categoryId: "category-casegoods", productId: "product-0501", assetCount: 32 },
      { categoryId: "category-casegoods", productId: "product-0501-new", assetCount: 12 },
      { categoryId: "category-casegoods", productId: "product-empty", assetCount: 0 },
    ]);

    expect(totals.get("category-casegoods")).toEqual({ assetGroupCount: 2, assetCount: 108 });
  });
});
