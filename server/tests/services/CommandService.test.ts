import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";
import { LocalConfigProvider } from "../../src/services/LocalConfigProvider";
import { CommandService } from "../../src/services/CommandService";

describe("CommandService", () => {
  let tmpDir: string;
  let provider: LocalConfigProvider;
  let service: CommandService;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "ocd-cmd-test-"));
    provider = new LocalConfigProvider(tmpDir);
    service = new CommandService(provider);
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("should list file-based commands", async () => {
    await fs.mkdir(path.join(tmpDir, "commands"), { recursive: true });
    await fs.writeFile(
      path.join(tmpDir, "commands/test.md"),
      "---\ndescription: Run tests\nagent: build\n---\nRun the test suite."
    );
    const commands = await service.list();
    expect(commands).toHaveLength(1);
    expect(commands[0].name).toBe("test");
    expect(commands[0].frontmatter.description).toBe("Run tests");
    expect(commands[0].frontmatter.agent).toBe("build");
    expect(commands[0].source).toBe("file");
  });

  it("should include JSON-defined commands as read-only", async () => {
    await fs.writeFile(
      path.join(tmpDir, "opencode.json"),
      JSON.stringify({
        command: {
          deploy: {
            template: "Deploy to production",
            description: "Deploy the app",
          },
        },
      })
    );
    const commands = await service.list();
    expect(commands).toHaveLength(1);
    expect(commands[0].name).toBe("deploy");
    expect(commands[0].source).toBe("json");
  });

  it("should merge file and JSON commands", async () => {
    await fs.mkdir(path.join(tmpDir, "commands"), { recursive: true });
    await fs.writeFile(
      path.join(tmpDir, "commands/test.md"),
      "---\ndescription: File command\n---\nBody."
    );
    await fs.writeFile(
      path.join(tmpDir, "opencode.json"),
      JSON.stringify({ command: { deploy: { template: "x", description: "JSON command" } } })
    );
    const commands = await service.list();
    expect(commands).toHaveLength(2);
    const names = commands.map((c) => c.name).sort();
    expect(names).toEqual(["deploy", "test"]);
  });

  it("should create a file-based command", async () => {
    const cmd = await service.create({
      name: "my-cmd",
      frontmatter: { description: "My command" },
      body: "Do something.",
    });
    expect(cmd.name).toBe("my-cmd");
    const content = await fs.readFile(path.join(tmpDir, "commands/my-cmd.md"), "utf-8");
    expect(content).toContain("description: My command");
  });

  it("should update a file-based command", async () => {
    await fs.mkdir(path.join(tmpDir, "commands"), { recursive: true });
    await fs.writeFile(
      path.join(tmpDir, "commands/test.md"),
      "---\ndescription: Old\n---\nOld body."
    );
    const updated = await service.update("test", {
      frontmatter: { description: "New" },
      body: "New body.",
    });
    expect(updated.frontmatter.description).toBe("New");
  });

  it("should delete a file-based command", async () => {
    await fs.mkdir(path.join(tmpDir, "commands"), { recursive: true });
    await fs.writeFile(
      path.join(tmpDir, "commands/test.md"),
      "---\ndescription: x\n---\nx"
    );
    await service.delete("test");
    const exists = await provider.exists("commands/test.md");
    expect(exists).toBe(false);
  });

  it("should reject deleting a JSON-defined command", async () => {
    await fs.writeFile(
      path.join(tmpDir, "opencode.json"),
      JSON.stringify({ command: { deploy: { template: "x", description: "x" } } })
    );
    await expect(service.delete("deploy")).rejects.toThrow();
  });
});
