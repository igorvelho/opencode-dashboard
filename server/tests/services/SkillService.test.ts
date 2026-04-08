import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";
import { LocalConfigProvider } from "../../src/services/LocalConfigProvider";
import { SkillService } from "../../src/services/SkillService";

describe("SkillService", () => {
  let tmpDir: string;
  let provider: LocalConfigProvider;
  let service: SkillService;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "ocd-skill-test-"));
    provider = new LocalConfigProvider(tmpDir);
    service = new SkillService(provider);
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("should list skills from skills/ directory", async () => {
    await fs.mkdir(path.join(tmpDir, "skills/my-skill"), { recursive: true });
    await fs.writeFile(
      path.join(tmpDir, "skills/my-skill/SKILL.md"),
      "---\nname: my-skill\ndescription: A test skill\n---\n\n# My Skill\nBody here."
    );
    const skills = await service.list();
    expect(skills).toHaveLength(1);
    expect(skills[0].name).toBe("my-skill");
    expect(skills[0].frontmatter.description).toBe("A test skill");
    expect(skills[0].body).toContain("# My Skill");
    expect(skills[0].source).toBe("custom");
  });

  it("should return empty array when skills/ does not exist", async () => {
    const skills = await service.list();
    expect(skills).toEqual([]);
  });

  it("should get a single skill by name", async () => {
    await fs.mkdir(path.join(tmpDir, "skills/my-skill"), { recursive: true });
    await fs.writeFile(
      path.join(tmpDir, "skills/my-skill/SKILL.md"),
      "---\nname: my-skill\ndescription: Test\n---\nBody."
    );
    const skill = await service.get("my-skill");
    expect(skill).toBeDefined();
    expect(skill!.name).toBe("my-skill");
  });

  it("should return undefined for non-existent skill", async () => {
    const skill = await service.get("nope");
    expect(skill).toBeUndefined();
  });

  it("should create a new skill", async () => {
    const skill = await service.create({
      name: "new-skill",
      frontmatter: { name: "new-skill", description: "Brand new" },
      body: "# New\nContent here.",
    });
    expect(skill.name).toBe("new-skill");
    const content = await fs.readFile(
      path.join(tmpDir, "skills/new-skill/SKILL.md"),
      "utf-8"
    );
    expect(content).toContain("name: new-skill");
    expect(content).toContain("description: Brand new");
    expect(content).toContain("# New");
  });

  it("should reject creating a skill with invalid name", async () => {
    await expect(
      service.create({
        name: "Invalid Name",
        frontmatter: { name: "Invalid Name", description: "bad" },
        body: "x",
      })
    ).rejects.toThrow();
  });

  it("should update an existing skill", async () => {
    await fs.mkdir(path.join(tmpDir, "skills/my-skill"), { recursive: true });
    await fs.writeFile(
      path.join(tmpDir, "skills/my-skill/SKILL.md"),
      "---\nname: my-skill\ndescription: Old\n---\nOld body."
    );
    const updated = await service.update("my-skill", {
      frontmatter: { name: "my-skill", description: "Updated" },
      body: "New body.",
    });
    expect(updated.frontmatter.description).toBe("Updated");
    expect(updated.body).toContain("New body.");
  });

  it("should delete a skill", async () => {
    await fs.mkdir(path.join(tmpDir, "skills/my-skill"), { recursive: true });
    await fs.writeFile(
      path.join(tmpDir, "skills/my-skill/SKILL.md"),
      "---\nname: my-skill\ndescription: x\n---\nx"
    );
    await service.delete("my-skill");
    const exists = await provider.exists("skills/my-skill");
    expect(exists).toBe(false);
  });
});
