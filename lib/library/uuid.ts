/**
 * Generates a UUID v4 string that works in both secure and insecure contexts.
 *
 * `crypto.randomUUID()` is only available in secure contexts (HTTPS / localhost).
 * When the site is accessed via a LAN IP over plain HTTP (e.g. http://192.168.1.136),
 * it is undefined and would throw `crypto.randomUUID is not a function`.
 * This helper falls back to a crypto.getRandomValues-based v4 implementation.
 */
export function generateUUID(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === "function") {
    return c.randomUUID();
  }

  // RFC 4122 v4 fallback using crypto.getRandomValues.
  const bytes = new Uint8Array(16);
  if (c && typeof c.getRandomValues === "function") {
    c.getRandomValues(bytes);
  } else {
    // Very old environment fallback; rare but keeps the app from crashing.
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  }

  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10xx

  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
