import "server-only";
import { LocalDiskStorage } from "./local";

/**
 * File storage seam.
 *
 * The database keeps only metadata (SampleAttachment); the bytes live behind
 * this interface. Today: local disk. In production: an object-storage driver
 * (S3 / Cloudflare R2 / Vercel Blob) implementing the same three methods —
 * nothing that calls `storage()` changes.
 */
export interface StorageDriver {
  put(key: string, data: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<Buffer | null>;
  delete(key: string): Promise<void>;
}

let driver: StorageDriver | null = null;

export function storage(): StorageDriver {
  if (driver) return driver;
  const kind = process.env.STORAGE_DRIVER ?? "local";
  switch (kind) {
    case "local":
      driver = new LocalDiskStorage(process.env.STORAGE_LOCAL_DIR ?? "./storage/uploads");
      return driver;
    default:
      throw new Error(`Unknown STORAGE_DRIVER "${kind}". Supported: local.`);
  }
}
