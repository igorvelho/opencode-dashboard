import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";
import { LocalConfigProvider } from "../../src/services/LocalConfigProvider";
import { AgentService } from "../../src/services/AgentService";

describe("AgentService", () => {
  let tmpDir: string;
  let provider: LocalConfigProvider;
  let service: AgentService;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "ocd-agent-test-"));
    provider = new LocalConfigProvider(tmpDir);
    service = new AgentService(provider);
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("should list file-based agents", async () => {
    await fs.mkdir(path.join(tmpDir, "agents"), { recursive: true });
    await fs.writeFile(
      path.join(tmpDir, "agents/reviewer.md"),
      "---\ndescription: Code reviewer\nmodel: gpt-4\n---\nYou are a code reviewer."
    );
    const agents = await service.list();
    expect(agents).toHaveLength(1);
    expect(agents[0].name).toBe("reviewer");
    expect(agents[0].frontmatter.description).toBe("Code reviewer");
    expect(agents[0].frontmatter.model).toBe("gpt-4");
    expect(agents[0].source).toBe("file");
  });

  it("should include JSON-defined agents", async () => {
    await fs.writeFile(
      path.join(tmpDir, "opencode.json"),
      JSON.stringify({
        agent: {
          tester: {
            description: "Test agent",
            model: "claude-3",
            system: "You run tests.",
          },
        },
      })
    );
    const agents = await service.list();
    expect(agents).toHaveLength(1);
    expect(agents[0].name).toBe("tester");
    expect(agents[0].source).toBe("json");
  });

  it("should merge file and JSON agents", async () => {
    await fs.mkdir(path.join(tmpDir, "agents"), { recursive: true });
    await fs.writeFile(
      path.join(tmpDir, "agents/reviewer.md"),
      "---\ndescription: File agent\n---\nBody."
    );
    await fs.writeFile(
      path.join(tmpDir, "opencode.json"),
      JSON.stringify({ agent: { tester: { description: "JSON agent", system: "x" } } })
    );
    const agents = await service.list();
    expect(agents).toHaveLength(2);
    const names = agents.map((a) => a.name).sort();
    expect(names).toEqual(["reviewer", "tester"]);
  });

  it("should create a file-based agent", async () => {
    const agent = await service.create({
      name: "new-agent",
      frontmatter: { description: "Brand new agent" },
      body: "You are a new agent.",
    });
    expect(agent.name).toBe("new-agent");
    const content = await fs.readFile(path.join(tmpDir, "agents/new-agent.md"), "utf-8");
    expect(content).toContain("description: Brand new agent");
  });

  it("should update a file-based agent", async () => {
    await fs.mkdir(path.join(tmpDir, "agents"), { recursive: true });
    await fs.writeFile(
      path.join(tmpDir, "agents/reviewer.md"),
      "---\ndescription: Old\n---\nOld body."
    );
    const updated = await service.update("reviewer", {
      frontmatter: { description: "Updated" },
      body: "New body.",
    });
    expect(updated.frontmatter.description).toBe("Updated");
  });

  it("should delete a file-based agent", async () => {
    await fs.mkdir(path.join(tmpDir, "agents"), { recursive: true });
    await fs.writeFile(
      path.join(tmpDir, "agents/reviewer.md"),
      "---\ndescription: x\n---\nx"
    );
    await service.delete("reviewer");
    const exists = await provider.exists("agents/reviewer.md");
    expect(exists).toBe(false);
  });

  it("should reject deleting a JSON-defined agent", async () => {
    await fs.writeFile(
      path.join(tmpDir, "opencode.json"),
      JSON.stringify({ agent: { tester: { description: "x", system: "x" } } })
    );
    await expect(service.delete("tester")).rejects.toThrow();
  });
});
