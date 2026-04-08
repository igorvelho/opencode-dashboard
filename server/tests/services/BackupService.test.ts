import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";
import { LocalConfigProvider } from "../../src/services/LocalConfigProvider";
import { BackupService } from "../../src/services/BackupService";

describe("BackupService", () => {
  let tmpDir: string;
  let provider: LocalConfigProvider;
  let service: BackupService;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "ocd-backup-test-"));
    provider = new LocalConfigProvider(tmpDir);
    service = new BackupService(provider);
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("should create a backup zip", async () => {
    await fs.writeFile(
      path.join(tmpDir, "opencode.json"),
      JSON.stringify({ mcp: { server1: { type: "local", command: ["node"] } } })
    );
    await fs.mkdir(path.join(tmpDir, "skills/my-skill"), { recursive: true });
    await fs.writeFile(
      path.join(tmpDir, "skills/my-skill/SKILL.md"),
      "---\nname: my-skill\ndescription: test\n---\nBody."
    );

    const result = await service.createBackup(false);
    expect(result.filename).toMatch(/^backup-.*\.zip$/);
    expect(result.size).toBeGreaterThan(0);

    // Verify the file exists
    const backupPath = path.join(tmpDir, "backups", result.filename);
    const stat = await fs.stat(backupPath);
    expect(stat.size).toBe(result.size);
  });

  it("should create a redacted backup", async () => {
    await fs.writeFile(
      path.join(tmpDir, "opencode.json"),
      JSON.stringify({
        provider: {
          openai: { options: { apiKey: "sk-secret-key-12345" } },
        },
        mcp: {
          server1: {
            type: "local",
            command: ["node"],
            environment: { SECRET_TOKEN: "my-secret" },
          },
        },
      })
    );

    const result = await service.createBackup(true);
    expect(result.redacted).toBe(true);
  });

  it("should list backups", async () => {
    await fs.writeFile(path.join(tmpDir, "opencode.json"), "{}");
    await service.createBackup(false);
    await service.createBackup(false);

    const backups = await service.listBackups();
    expect(backups).toHaveLength(2);
    expect(backups[0].filename).toMatch(/^backup-.*\.zip$/);
  });

  it("should return empty list when no backups exist", async () => {
    const backups = await service.listBackups();
    expect(backups).toEqual([]);
  });

  it("should restore from a backup zip", async () => {
    // Create initial content
    await fs.writeFile(
      path.join(tmpDir, "opencode.json"),
      JSON.stringify({ mcp: { server1: { type: "local", command: ["node"] } } })
    );
    await fs.mkdir(path.join(tmpDir, "skills/my-skill"), { recursive: true });
    await fs.writeFile(
      path.join(tmpDir, "skills/my-skill/SKILL.md"),
      "---\nname: my-skill\ndescription: original\n---\nOriginal body."
    );

    // Create backup
    const backup = await service.createBackup(false);

    // Modify content
    await fs.writeFile(
      path.join(tmpDir, "opencode.json"),
      JSON.stringify({ modified: true })
    );

    // Restore
    const backupPath = path.join(tmpDir, "backups", backup.filename);
    const zipBuffer = await fs.readFile(backupPath);
    await service.restore(zipBuffer);

    // Verify restoration
    const restored = await fs.readFile(path.join(tmpDir, "opencode.json"), "utf-8");
    const parsed = JSON.parse(restored);
    expect(parsed.mcp).toBeDefined();
  });
});
