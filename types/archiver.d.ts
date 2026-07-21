declare module "archiver" {
  import type { Readable, Transform } from "node:stream";

  export interface Archiver extends Transform {
    append(source: Readable | Uint8Array | string, data: { name: string }): this;
    finalize(): Promise<void>;
  }

  type ArchiverFactory = (format: "zip", options: { zlib: { level: number } }) => Archiver;
  const archiver: ArchiverFactory;
  export default archiver;
}
