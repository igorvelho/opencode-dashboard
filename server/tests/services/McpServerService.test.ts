import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";
import { LocalConfigProvider } from "../../src/services/LocalConfigProvider";
import { McpServerService } from "../../src/services/McpServerService";

describe("McpServerService", () => {
  let tmpDir: string;
  let provider: LocalConfigProvider;
  let service: McpServerService;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "ocd-mcp-test-"));
    provider = new LocalConfigProvider(tmpDir);
    service = new McpServerService(provider);
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("should list MCP servers from opencode.json", async () => {
    await fs.writeFile(
      path.join(tmpDir, "opencode.json"),
      JSON.stringify({
        mcp: {
          "my-server": {
            type: "local",
            command: ["node", "server.js"],
            enabled: true,
          },
        },
      })
    );
    const servers = await service.list();
    expect(servers).toHaveLength(1);
    expect(servers[0].name).toBe("my-server");
    expect(servers[0].config.type).toBe("local");
  });

  it("should return empty array when no config exists", async () => {
    const servers = await service.list();
    expect(servers).toEqual([]);
  });

  it("should get a single server by name", async () => {
    await fs.writeFile(
      path.join(tmpDir, "opencode.json"),
      JSON.stringify({
        mcp: {
          "my-server": { type: "local", command: ["node"], enabled: true },
        },
      })
    );
    const server = await service.get("my-server");
    expect(server).toBeDefined();
    expect(server!.name).toBe("my-server");
  });

  it("should create a new MCP server", async () => {
    await fs.writeFile(path.join(tmpDir, "opencode.json"), "{}");
    const server = await service.create("new-server", {
      type: "local",
      command: ["python", "serve.py"],
      enabled: true,
    });
    expect(server.name).toBe("new-server");

    const raw = await fs.readFile(path.join(tmpDir, "opencode.json"), "utf-8");
    const config = JSON.parse(raw);
    expect(config.mcp["new-server"]).toBeDefined();
  });

  it("should update an existing MCP server", async () => {
    await fs.writeFile(
      path.join(tmpDir, "opencode.json"),
      JSON.stringify({
        mcp: { "my-server": { type: "local", command: ["node"], enabled: true } },
      })
    );
    const updated = await service.update("my-server", {
      type: "local",
      command: ["node", "new-server.js"],
      enabled: false,
    });
    expect(updated.config.command).toEqual(["node", "new-server.js"]);
  });

  it("should toggle a server enabled status", async () => {
    await fs.writeFile(
      path.join(tmpDir, "opencode.json"),
      JSON.stringify({
        mcp: { "my-server": { type: "local", command: ["node"], enabled: true } },
      })
    );
    const toggled = await service.toggle("my-server");
    expect(toggled.config.enabled).toBe(false);
  });

  it("should delete a server", async () => {
    await fs.writeFile(
      path.join(tmpDir, "opencode.json"),
      JSON.stringify({
        mcp: { "my-server": { type: "local", command: ["node"], enabled: true } },
      })
    );
    await service.delete("my-server");
    const raw = await fs.readFile(path.join(tmpDir, "opencode.json"), "utf-8");
    const config = JSON.parse(raw);
    expect(config.mcp["my-server"]).toBeUndefined();
  });
});
