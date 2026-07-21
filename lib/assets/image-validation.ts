import sharp from "sharp";

const formats = new Map([
  ["jpeg", { mimeType: "image/jpeg", extension: "jpg" }],
  ["png", { mimeType: "image/png", extension: "png" }],
  ["webp", { mimeType: "image/webp", extension: "webp" }],
]);

export class ImageValidationError extends Error {
  constructor(message: string) {
    super(message);
  }
}

export function resolveImageFormat(format: string | undefined) {
  const resolved = format ? formats.get(format) : undefined;
  if (!resolved) throw new ImageValidationError("仅支持 JPEG、PNG 或 WEBP 图片。");
  return resolved;
}

export async function verifyImageBuffer(source: Uint8Array) {
  try {
    const metadata = await sharp(source, { failOn: "error" }).metadata();
    const format = resolveImageFormat(metadata.format);
    if (!metadata.width || !metadata.height) throw new ImageValidationError("无法读取图片尺寸。");
    return { ...format, width: metadata.width, height: metadata.height };
  } catch (error) {
    if (error instanceof ImageValidationError) throw error;
    throw new ImageValidationError("仅支持 JPEG、PNG 或 WEBP 图片。");
  }
}
