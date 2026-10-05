import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { StorageDriver } from "./index";

export class LocalDiskStorage implements StorageDriver {
  private root: string;

  constructor(dir: string) {
    this.root = path.resolve(process.cwd(), dir);
  }

  private resolve(key: string): string {
    const full = path.resolve(this.root, key);
    // Keys are generated server-side, but never let one escape the root.
    if (!full.startsWith(this.root + path.sep)) throw new Error("Invalid storage key");
    return full;
  }

  async put(key: string, data: Buffer): Promise<void> {
    const full = this.resolve(key);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, data);
  }

  async get(key: string): Promise<Buffer | null> {
    try {
      return await fs.readFile(this.resolve(key));
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw e;
    }
  }

  async delete(key: string): Promise<void> {
    await fs.rm(this.resolve(key), { force: true });
  }
}
