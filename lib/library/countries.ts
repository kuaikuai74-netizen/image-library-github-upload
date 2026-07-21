export const countryOptions = [
  { code: "DE", name: "德国" },
  { code: "UK", name: "英国" },
  { code: "FR", name: "法国" },
  { code: "IT", name: "意大利" },
  { code: "ES", name: "西班牙" },
  { code: "NL", name: "荷兰" },
  { code: "PL", name: "波兰" },
] as const;

const countryNames = new Map<string, string>(countryOptions.map((country) => [country.code, country.name]));

export function countryName(countryCode: string) {
  return countryNames.get(countryCode) ?? countryCode;
}

export const assetTypeOptions = ["主副图", "A+详情页", "品牌营销", "其他"] as const;
