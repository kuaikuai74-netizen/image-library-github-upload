import { describe, expect, it } from "vitest";
import { archiveCountryIdempotencyKey, archivePathCandidates, classifyArchiveEntry, compareArchivePaths } from "../lib/assets/archive-routes";
import { archiveUploadRequestSchema } from "../lib/assets/archive-upload-schema";
import { contextUploadRequestSchema, parseUploadMetadataField } from "../lib/assets/upload-schema";
import { UploadError } from "../lib/assets/upload-errors";

describe("ZIP archive upload routing", () => {
  it("maps the confirmed language folders to countries, including English to the UK", () => {
    expect(classifyArchiveEntry("0501主图/德语/白色/主图1.jpg")).toMatchObject({ kind: "image", countryCode: "DE", other: "白色", filename: "主图1.jpg" });
    expect(classifyArchiveEntry("英语/黑色/主图2.jpg")).toMatchObject({ kind: "image", countryCode: "UK", other: "黑色" });
    expect(classifyArchiveEntry("法语/粉色/主图3.webp")).toMatchObject({ kind: "image", countryCode: "FR", other: "粉色" });
    expect(classifyArchiveEntry("意大利语/白色/主图4.png")).toMatchObject({ kind: "image", countryCode: "IT", other: "白色" });
    expect(classifyArchiveEntry("西班牙语/白色套装/主图5.jpeg")).toMatchObject({ kind: "image", countryCode: "ES", other: "白色套装" });
    expect(classifyArchiveEntry("英语/英标/主图6.jpg")).toMatchObject({ kind: "image", countryCode: "UK", other: "英标" });
  });

  it("accepts real-world ZIP path variants from different archive tools", () => {
    expect(classifyArchiveEntry("1333蹦床新品/ 德语 /白色/主图1.JPG")).toMatchObject({ kind: "image", countryCode: "DE", other: "白色" });
    expect(classifyArchiveEntry("1333蹦床新品\\法语\\白色\\主图2.png")).toMatchObject({ kind: "image", countryCode: "FR", other: "白色" });
    expect(classifyArchiveEntry("1333蹦床新品/西班牙：Spain/主图3.webp")).toMatchObject({ kind: "image", countryCode: "ES", other: null });
    expect(classifyArchiveEntry("1333蹦床新品/英国/英标/主图4.jpeg")).toMatchObject({ kind: "image", countryCode: "UK", other: "英标" });
    expect(classifyArchiveEntry("1333蹦床新品/意大利/欧标/主图5.jpg")).toMatchObject({ kind: "image", countryCode: "IT", other: "欧标" });
  });

  it("can recover Chinese folder names from GBK encoded ZIP paths", () => {
    const gbkPath = Buffer.from("313333332fb5c2d3ef2fb0d7c9ab2fd6f7cdbc312e6a7067", "hex");
    const candidates = archivePathCandidates("1333/╡┬╙∩/░╫╔½/╓ў═╝1.jpg", gbkPath);

    expect(candidates.some((path) => classifyArchiveEntry(path).kind === "image")).toBe(true);
    expect(candidates.map(classifyArchiveEntry).find((entry) => entry.kind === "image")).toMatchObject({ countryCode: "DE", other: "白色", filename: "主图1.jpg" });
  });

  it("ignores archive metadata and unsupported or unrecognized paths", () => {
    expect(classifyArchiveEntry("__MACOSX/德语/._主图1.jpg")).toMatchObject({ kind: "skip", reason: "系统文件" });
    expect(classifyArchiveEntry("点击查看所有图片.html")).toMatchObject({ kind: "skip", reason: "非支持图片" });
    expect(classifyArchiveEntry("荷兰语/主图1.jpg")).toMatchObject({ kind: "skip", reason: "未识别国家目录" });
    expect(classifyArchiveEntry("toString/主图1.jpg")).toMatchObject({ kind: "skip", reason: "未识别国家目录" });
    expect(classifyArchiveEntry("../德语/主图1.jpg")).toMatchObject({ kind: "skip", reason: "不安全的压缩包路径" });
  });

  it("uses deterministic per-country idempotency keys and natural archive ordering", () => {
    const key = "7b558558-ff56-4ff7-a509-693c79885b25";
    expect(archiveCountryIdempotencyKey(key, "DE")).toMatch(/^[a-f0-9]{8}-[a-f0-9]{4}-5[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);
    expect(archiveCountryIdempotencyKey(key, "DE")).toBe(archiveCountryIdempotencyKey(key, "DE"));
    expect(archiveCountryIdempotencyKey(key, "DE")).not.toBe(archiveCountryIdempotencyKey(key, "FR"));
    expect(["德语/主图10.jpg", "德语/主图2.jpg"].sort(compareArchivePaths)).toEqual(["德语/主图2.jpg", "德语/主图10.jpg"]);
  });

  it("requires the archive upload context", () => {
    expect(archiveUploadRequestSchema.parse({ channelId: "channel-amazon", categoryId: "category-tables", spu: "Vertex Lift 01", assetType: "主副图", idempotencyKey: "7b558558-ff56-4ff7-a509-693c79885b25" })).toMatchObject({ spu: "Vertex Lift 01" });
    expect(() => archiveUploadRequestSchema.parse({ channelId: "channel-amazon", categoryId: "category-tables", spu: "", assetType: "主副图", idempotencyKey: "7b558558-ff56-4ff7-a509-693c79885b25" })).toThrow();
  });

  it("accepts a free-text SPU context without a pre-existing asset group", () => {
    expect(contextUploadRequestSchema.parse({
      channelId: "channel-amazon",
      categoryId: "category-tables",
      spu: "0501",
      countryCode: "DE",
      assetType: "主副图",
      idempotencyKey: "7b558558-ff56-4ff7-a509-693c79885b25",
      metadata: [{ assetType: "主副图", sortOrder: 1 }],
    })).toMatchObject({ spu: "0501", countryCode: "DE" });
    expect(() => contextUploadRequestSchema.parse({
      channelId: "channel-amazon",
      categoryId: "category-tables",
      spu: "0501",
      countryCode: "US",
      assetType: "主副图",
      idempotencyKey: "7b558558-ff56-4ff7-a509-693c79885b25",
      metadata: [{ assetType: "主副图", sortOrder: 1 }],
    })).toThrow();
  });

  it("reports invalid upload metadata as a typed upload error", () => {
    expect(() => parseUploadMetadataField("{")).toThrow(UploadError);
    expect(() => parseUploadMetadataField("{")).toThrow("上传元数据无效。");
    expect(parseUploadMetadataField("[{\"assetType\":\"主副图\",\"sortOrder\":1}]")).toEqual([{ assetType: "主副图", sortOrder: 1 }]);
  });
});
