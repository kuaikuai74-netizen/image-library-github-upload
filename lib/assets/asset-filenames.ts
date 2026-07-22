import { countryName } from "../library/countries";

type AssetDisplayFilenameInput = {
  spu: string;
  countryCode: string;
  assetType: string;
  other?: string;
  sortOrder: number;
  originalFilename: string;
};

function filenameExtension(filename: string) {
  const extension = filename.match(/\.([a-z0-9]{1,8})$/i)?.[1]?.toLowerCase();
  return extension || "jpg";
}

function safeFilenamePart(value: string) {
  return value.trim().replace(/[\\/:*?"<>|]/g, "_").replace(/\s+/g, "_").replace(/_+/g, "_").slice(0, 80) || "未命名";
}

export function createAssetDisplayFilename(input: AssetDisplayFilenameInput) {
  const sequence = String(input.sortOrder).padStart(2, "0");
  const extension = filenameExtension(input.originalFilename);
  const parts = [
    safeFilenamePart(input.spu),
    safeFilenamePart(countryName(input.countryCode)),
    safeFilenamePart(input.assetType),
  ];
  const other = input.other?.trim();
  if (other && other !== "未指定") parts.push(safeFilenamePart(other));
  parts.push(sequence);
  return parts.join("_") + `.${extension}`;
}
