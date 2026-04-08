import * as fs from "fs/promises";
import * as path from "path";
import { ConfigProvider } from "./ConfigProvider";

export class LocalConfigProvider implements ConfigProvider {
  private basePath: string;

  constructor(basePath: string) {
    this.basePath = path.resolve(basePath);
  }

  private resolve(relativePath: string): string {
    const resolved = path.resolve(this.basePath, relativePath);
    // Prevent path traversal outside basePath
    if (!resolved.startsWith(this.basePath)) {
      throw new Error(`Path traversal detected: ${relativePath}`);
    }
    return resolved;
  }

  async readFile(relativePath: string): Promise<string> {
    const fullPath = this.resolve(relativePath);
    return fs.readFile(fullPath, "utf-8");
  }

  async writeFile(relativePath: string, content: string): Promise<void> {
    const fullPath = this.resolve(relativePath);
    const dir = path.dirname(fullPath);
    await fs.mkdir(dir, { recursive: true });

    // Atomic write: write to temp, then rename
    const tmpPath = fullPath + ".tmp." + process.pid;
    try {
      await fs.writeFile(tmpPath, content, "utf-8");
      await fs.rename(tmpPath, fullPath);
    } catch (err) {
      // Clean up temp file on failure
      try {
        await fs.unlink(tmpPath);
      } catch {
        // ignore cleanup errors
      }
      throw err;
    }
  }

  async deleteFile(relativePath: string): Promise<void> {
    const fullPath = this.resolve(relativePath);
    await fs.unlink(fullPath);
  }

  async deleteDirectory(relativePath: string): Promise<void> {
    const fullPath = this.resolve(relativePath);
    await fs.rm(fullPath, { recursive: true, force: true });
  }

  async listDirectory(relativePath: string): Promise<string[]> {
    const fullPath = this.resolve(relativePath);
    const entries = await fs.readdir(fullPath);
    return entries;
  }

  async exists(relativePath: string): Promise<boolean> {
    try {
      const fullPath = this.resolve(relativePath);
      await fs.access(fullPath);
      return true;
    } catch {
      return false;
    }
  }

  async getLastModified(relativePath: string): Promise<Date> {
    const fullPath = this.resolve(relativePath);
    const stats = await fs.stat(fullPath);
    return stats.mtime;
  }

  getBasePath(): string {
    return this.basePath;
  }
}
