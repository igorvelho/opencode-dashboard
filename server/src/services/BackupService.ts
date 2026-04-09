import * as fs from "fs/promises";
import * as path from "path";
import * as crypto from "crypto";
import archiver from "archiver";
import * as unzipper from "unzipper";
import * as jsonc from "jsonc-parser";
import { ConfigProvider } from "./ConfigProvider";
import { BackupEntry, BackupManifest, BackupSection, ALL_BACKUP_SECTIONS } from "../../../shared/types";

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

/** Maps BackupSection to the directory that stores its files */
const SECTION_DIRS: Record<string, string> = {
  skills: "skills",
  commands: "commands",
  agents: "agents",
};

/** Maps BackupSection to the key inside opencode.json */
const SECTION_JSON_KEYS: Record<string, string> = {
  mcpServers: "mcp",
  providers: "provider",
};

export class BackupService {
  constructor(private provider: ConfigProvider) {}

  async createBackup(
    redact: boolean,
    sections: BackupSection[] = ALL_BACKUP_SECTIONS
  ): Promise<BackupEntry> {
    const basePath = this.provider.getBasePath();
    const backupsDir = path.join(basePath, "backups");
    await fs.mkdir(backupsDir, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `backup-${timestamp}.zip`;
    const zipPath = path.join(backupsDir, filename);

    const filesToBackup = await this.collectFilteredFiles(basePath, sections);
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

      // For opencode.json, filter to only include selected JSON sections
      if (relPath === "opencode.json" && !sections.includes("config")) {
        content = this.filterJsonSections(content, sections);
      }

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
      sections,
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
      sections,
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
              if (offset < 10) return "-";
              return m;
            })
          : stat.mtime.toISOString();

        // Try to read manifest to get sections info
        let sections: BackupSection[] = ALL_BACKUP_SECTIONS;
        let redacted = false;
        try {
          const zip = await unzipper.Open.file(fullPath);
          const manifestFile = zip.files.find((f) => f.path === "manifest.json");
          if (manifestFile) {
            const manifestContent = await manifestFile.buffer();
            const manifest: BackupManifest = JSON.parse(manifestContent.toString("utf-8"));
            sections = manifest.sections || ALL_BACKUP_SECTIONS;
            redacted = manifest.redacted;
          }
        } catch {
          // If we can't read the manifest, assume all sections
        }

        backups.push({
          filename: entry,
          timestamp,
          redacted,
          sections,
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

  /**
   * Collect only files relevant to the selected sections.
   */
  private async collectFilteredFiles(
    basePath: string,
    sections: BackupSection[]
  ): Promise<string[]> {
    const files: string[] = [];
    const skipDirs = new Set(["backups", "node_modules", ".git", "memory"]);

    // Determine which top-level dirs to include
    const includedDirs = new Set<string>();
    for (const section of sections) {
      const dir = SECTION_DIRS[section];
      if (dir) includedDirs.add(dir);
    }

    // Include opencode.json if config, mcpServers, or providers are selected
    const needsJson =
      sections.includes("config") ||
      sections.includes("mcpServers") ||
      sections.includes("providers");

    if (needsJson) {
      try {
        await fs.access(path.join(basePath, "opencode.json"));
        files.push("opencode.json");
      } catch {
        // opencode.json doesn't exist, skip
      }
    }

    // Walk included directories
    for (const dir of includedDirs) {
      const dirPath = path.join(basePath, dir);
      await this.walkDir(dirPath, dir, files, skipDirs);
    }

    return files;
  }

  private async walkDir(
    dir: string,
    prefix: string,
    files: string[],
    skipDirs: Set<string>
  ): Promise<void> {
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
        await this.walkDir(fullPath, relPath, files, skipDirs);
      } else {
        files.push(relPath);
      }
    }
  }

  /**
   * When "config" is not selected but mcpServers/providers are,
   * produce a filtered opencode.json containing only the selected JSON keys.
   */
  private filterJsonSections(raw: string, sections: BackupSection[]): string {
    const parsed = jsonc.parse(raw, undefined, { allowTrailingComma: true }) || {};
    const filtered: Record<string, unknown> = {};

    for (const section of sections) {
      const jsonKey = SECTION_JSON_KEYS[section];
      if (jsonKey && parsed[jsonKey] !== undefined) {
        filtered[jsonKey] = parsed[jsonKey];
      }
    }

    return JSON.stringify(filtered, null, 2);
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

  private redactObject(obj: unknown, pathStr: string, redactedFields: string[]): void {
    if (typeof obj !== "object" || obj === null) return;

    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      const currentPath = pathStr ? `${pathStr}.${key}` : key;

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
