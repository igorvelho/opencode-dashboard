import * as fs from "fs/promises";
import * as path from "path";
import * as crypto from "crypto";
import archiver from "archiver";
import * as unzipper from "unzipper";
import { ConfigProvider } from "./ConfigProvider";
import { BackupEntry, BackupManifest } from "../../../shared/types";
import { Readable } from "stream";

// Fields that may contain secrets and should be redacted
const SENSITIVE_KEYS = [
  "apiKey",
  "api_key",
  "secret",
  "token",
  "password",
  "SECRET_TOKEN",
  "OPENAI_API_KEY",
  "ANTHROPIC_API_KEY",
];

export class BackupService {
  constructor(private provider: ConfigProvider) {}

  async createBackup(redact: boolean): Promise<BackupEntry> {
    const basePath = this.provider.getBasePath();
    const backupsDir = path.join(basePath, "backups");
    await fs.mkdir(backupsDir, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `backup-${timestamp}.zip`;
    const zipPath = path.join(backupsDir, filename);

    // Collect files to backup
    const filesToBackup = await this.collectFiles(basePath);
    const redactedFields: string[] = [];

    // Create zip
    const output = await fs.open(zipPath, "w");
    const writeStream = output.createWriteStream();
    const archive = archiver("zip", { zlib: { level: 9 } });

    const archivePromise = new Promise<void>((resolve, reject) => {
      writeStream.on("close", resolve);
      archive.on("error", reject);
    });

    archive.pipe(writeStream);

    const manifestFiles: Array<{ path: string; checksum: string }> = [];

    for (const relPath of filesToBackup) {
      const fullPath = path.join(basePath, relPath);
      let content = await fs.readFile(fullPath, "utf-8");

      if (redact && (relPath === "opencode.json" || relPath.endsWith(".json"))) {
        const result = this.redactSecrets(content);
        content = result.content;
        redactedFields.push(...result.redactedFields.map((f) => `${relPath}:${f}`));
      }

      const checksum = crypto.createHash("sha256").update(content).digest("hex");
      manifestFiles.push({ path: relPath, checksum });

      archive.append(content, { name: relPath });
    }

    // Add manifest
    const manifest: BackupManifest = {
      timestamp: new Date().toISOString(),
      redacted: redact,
      redactedFields,
      files: manifestFiles,
    };
    archive.append(JSON.stringify(manifest, null, 2), { name: "manifest.json" });

    await archive.finalize();
    await archivePromise;

    const stat = await fs.stat(zipPath);

    return {
      filename,
      timestamp: manifest.timestamp,
      redacted: redact,
      size: stat.size,
    };
  }

  async listBackups(): Promise<BackupEntry[]> {
    const basePath = this.provider.getBasePath();
    const backupsDir = path.join(basePath, "backups");

    try {
      const entries = await fs.readdir(backupsDir);
      const backups: BackupEntry[] = [];

      for (const entry of entries) {
        if (!entry.endsWith(".zip")) continue;
        const fullPath = path.join(backupsDir, entry);
        const stat = await fs.stat(fullPath);

        // Try to extract timestamp from filename
        const match = entry.match(/^backup-(.+)\.zip$/);
        const timestamp = match
          ? match[1].replace(/-/g, (m, offset: number) => {
              // Restore ISO format: first 10 chars use '-', then 'T', then ':' and '.'
              if (offset < 10) return "-";
              return m;
            })
          : stat.mtime.toISOString();

        backups.push({
          filename: entry,
          timestamp,
          redacted: false, // Would need to read manifest to know
          size: stat.size,
        });
      }

      return backups.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    } catch {
      return [];
    }
  }

  async restore(zipBuffer: Buffer): Promise<void> {
    const basePath = this.provider.getBasePath();

    const directory = await unzipper.Open.buffer(zipBuffer);

    for (const file of directory.files) {
      if (file.path === "manifest.json") continue;
      if (file.type === "Directory") continue;

      const content = await file.buffer();
      const targetPath = path.join(basePath, file.path);
      const targetDir = path.dirname(targetPath);

      await fs.mkdir(targetDir, { recursive: true });
      await fs.writeFile(targetPath, content);
    }
  }

  private async collectFiles(basePath: string): Promise<string[]> {
    const files: string[] = [];
    const skipDirs = new Set(["backups", "node_modules", ".git"]);

    const walk = async (dir: string, prefix: string): Promise<void> => {
      let entries: string[];
      try {
        entries = await fs.readdir(dir);
      } catch {
        return;
      }

      for (const entry of entries) {
        if (skipDirs.has(entry)) continue;
        const fullPath = path.join(dir, entry);
        const relPath = prefix ? `${prefix}/${entry}` : entry;

        const stat = await fs.stat(fullPath);
        if (stat.isDirectory()) {
          await walk(fullPath, relPath);
        } else {
          files.push(relPath);
        }
      }
    };

    await walk(basePath, "");
    return files;
  }

  private redactSecrets(content: string): { content: string; redactedFields: string[] } {
    const redactedFields: string[] = [];

    try {
      const obj = JSON.parse(content);
      this.redactObject(obj, "", redactedFields);
      return { content: JSON.stringify(obj, null, 2), redactedFields };
    } catch {
      return { content, redactedFields };
    }
  }

  private redactObject(obj: unknown, path: string, redactedFields: string[]): void {
    if (typeof obj !== "object" || obj === null) return;

    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      const currentPath = path ? `${path}.${key}` : key;

      if (typeof value === "string" && this.isSensitiveKey(key)) {
        (obj as Record<string, unknown>)[key] = "***REDACTED***";
        redactedFields.push(currentPath);
      } else if (typeof value === "object" && value !== null) {
        this.redactObject(value, currentPath, redactedFields);
      }
    }
  }

  private isSensitiveKey(key: string): boolean {
    const lowerKey = key.toLowerCase();
    return SENSITIVE_KEYS.some(
      (sensitive) =>
        lowerKey === sensitive.toLowerCase() ||
        lowerKey.includes("key") ||
        lowerKey.includes("secret") ||
        lowerKey.includes("token") ||
        lowerKey.includes("password")
    );
  }
}
