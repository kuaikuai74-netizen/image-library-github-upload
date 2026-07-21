import { describe, expect, it } from "vitest";
import { assetOrderBy } from "../lib/library/asset-order";

describe("asset list ordering", () => {
  it("orders by configured sort order and then newest creation time", () => {
    expect(assetOrderBy).toEqual([{ sortOrder: "asc" }, { createdAt: "desc" }]);
  });
});
