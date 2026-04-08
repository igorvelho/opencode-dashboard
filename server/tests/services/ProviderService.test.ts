import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";
import { LocalConfigProvider } from "../../src/services/LocalConfigProvider";
import { ProviderService } from "../../src/services/ProviderService";

describe("ProviderService", () => {
  let tmpDir: string;
  let provider: LocalConfigProvider;
  let service: ProviderService;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "ocd-provider-test-"));
    provider = new LocalConfigProvider(tmpDir);
    service = new ProviderService(provider);
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("should list providers from opencode.json", async () => {
    await fs.writeFile(
      path.join(tmpDir, "opencode.json"),
      JSON.stringify({
        provider: {
          openai: {
            options: { apiKey: "sk-xxx" },
            models: { "gpt-4": { options: {} } },
          },
        },
      })
    );
    const providers = await service.list();
    expect(providers).toHaveLength(1);
    expect(providers[0].name).toBe("openai");
    expect(providers[0].config.options).toBeDefined();
  });

  it("should return empty array when no config exists", async () => {
    const providers = await service.list();
    expect(providers).toEqual([]);
  });

  it("should get a single provider by name", async () => {
    await fs.writeFile(
      path.join(tmpDir, "opencode.json"),
      JSON.stringify({
        provider: { openai: { options: {} } },
      })
    );
    const prov = await service.get("openai");
    expect(prov).toBeDefined();
    expect(prov!.name).toBe("openai");
  });

  it("should create a new provider", async () => {
    await fs.writeFile(path.join(tmpDir, "opencode.json"), "{}");
    const prov = await service.create("anthropic", {
      options: { apiKey: "sk-ant-xxx" },
    });
    expect(prov.name).toBe("anthropic");

    const raw = await fs.readFile(path.join(tmpDir, "opencode.json"), "utf-8");
    const config = JSON.parse(raw);
    expect(config.provider.anthropic).toBeDefined();
  });

  it("should update an existing provider", async () => {
    await fs.writeFile(
      path.join(tmpDir, "opencode.json"),
      JSON.stringify({
        provider: { openai: { options: { apiKey: "old" } } },
      })
    );
    const updated = await service.update("openai", {
      options: { apiKey: "new-key" },
    });
    expect(updated.config.options).toEqual({ apiKey: "new-key" });
  });

  it("should delete a provider", async () => {
    await fs.writeFile(
      path.join(tmpDir, "opencode.json"),
      JSON.stringify({
        provider: { openai: { options: {} } },
      })
    );
    await service.delete("openai");
    const raw = await fs.readFile(path.join(tmpDir, "opencode.json"), "utf-8");
    const config = JSON.parse(raw);
    expect(config.provider.openai).toBeUndefined();
  });

  it("should reject deleting a non-existent provider", async () => {
    await fs.writeFile(path.join(tmpDir, "opencode.json"), "{}");
    await expect(service.delete("nope")).rejects.toThrow();
  });
});
