import { describe, expect, it } from "vitest";
import { assetIdsSchema, assetMutationSchema } from "../lib/assets/asset-schema";

describe("asset management schemas", () => {
  it("accepts editable asset metadata and a destination group", () => {
    const result = assetMutationSchema.parse({ assetType: "A+详情页", sortOrder: "3", color: "白色", notes: "首页图片", assetGroupId: "group-amazon-tables" });
    expect(result).toMatchObject({ assetType: "A+详情页", sortOrder: 3, color: "白色", assetGroupId: "group-amazon-tables" });
  });

  it("requires at least one change and deduplicates batch item ids", () => {
    expect(() => assetMutationSchema.parse({})).toThrow();
    expect(assetIdsSchema.parse({ assetIds: ["asset-amazon-tables-1", "asset-amazon-tables-1", "asset-amazon-tables-2"] }).assetIds).toEqual(["asset-amazon-tables-1", "asset-amazon-tables-2"]);
  });
});
