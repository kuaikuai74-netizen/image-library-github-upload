import { describe, expect, it } from "vitest";
import { assetQuerySchema } from "../lib/library/query-schema";

describe("asset query schema", () => {
  it("parses combined filters and enforces pagination defaults", () => {
    const query = assetQuerySchema.parse({
      channelId: "channel-amazon",
      categoryId: "category-tables",
      countryCode: "de",
      assetType: "主副图",
      color: "白色",
      spu: "Vertex Lift 01",
      filename: "01.jpg",
      page: "2",
      pageSize: "24",
    });
    expect(query).toMatchObject({ countryCode: "DE", page: 2, pageSize: 24, color: "白色" });
  });

  it("rejects an oversized page size and malformed identifier", () => {
    expect(() => assetQuerySchema.parse({ pageSize: "101" })).toThrow();
    expect(() => assetQuerySchema.parse({ channelId: "not valid" })).toThrow();
  });
});
