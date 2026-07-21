import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { verifyImageBuffer } from "../lib/assets/image-validation";

describe("image validation", () => {
  it("accepts an image based on decoded content instead of its browser MIME label", async () => {
    const png = await sharp({ create: { width: 3, height: 2, channels: 3, background: "#ffffff" } }).png().toBuffer();
    await expect(verifyImageBuffer(png)).resolves.toMatchObject({ mimeType: "image/png", extension: "png", width: 3, height: 2 });
  });

  it("rejects non-image bytes", async () => {
    await expect(verifyImageBuffer(Buffer.from("not an image"))).rejects.toThrow("仅支持 JPEG、PNG 或 WEBP 图片。");
  });
});
