import { describe, expect, it } from "vitest";
import { createAssetDisplayFilename } from "../lib/assets/asset-filenames";

describe("createAssetDisplayFilename", () => {
  it("builds display names from selected upload options", () => {
    expect(createAssetDisplayFilename({
      spu: "0884",
      countryCode: "UK",
      assetType: "主副图",
      other: "英标",
      sortOrder: 3,
      originalFilename: "主图3.png",
    })).toBe("0884_英国_主副图_英标_03.png");
  });

  it("removes characters that cannot be used in download filenames", () => {
    expect(createAssetDisplayFilename({
      spu: "08/84",
      countryCode: "DE",
      assetType: "A+详情页",
      sortOrder: 12,
      originalFilename: "image",
    })).toBe("08_84_德国_A+详情页_12.jpg");
  });
});
