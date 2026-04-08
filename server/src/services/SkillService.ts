import matter from "gray-matter";
import { ConfigProvider } from "./ConfigProvider";
import { Skill, SkillFrontmatter } from "../../../shared/types";
import { skillFrontmatterSchema } from "../../../shared/schemas";
import { AppError } from "../middleware/errorHandler";

interface CreateSkillInput {
  name: string;
  frontmatter: SkillFrontmatter;
  body: string;
}

interface UpdateSkillInput {
  frontmatter: SkillFrontmatter;
  body: string;
}

export class SkillService {
  constructor(private provider: ConfigProvider) {}

  async list(): Promise<Skill[]> {
    const skillsDir = "skills";
    const dirExists = await this.provider.exists(skillsDir);
    if (!dirExists) return [];

    const entries = await this.provider.listDirectory(skillsDir);
    const skills: Skill[] = [];

    for (const entry of entries) {
      const skillPath = `${skillsDir}/${entry}/SKILL.md`;
      const exists = await this.provider.exists(skillPath);
      if (!exists) continue;

      try {
        const skill = await this.parseSkill(entry, skillPath);
        skills.push(skill);
      } catch {
        // Skip malformed skills
      }
    }

    return skills;
  }

  async get(name: string): Promise<Skill | undefined> {
    const skillPath = `skills/${name}/SKILL.md`;
    const exists = await this.provider.exists(skillPath);
    if (!exists) return undefined;
    return this.parseSkill(name, skillPath);
  }

  async create(input: CreateSkillInput): Promise<Skill> {
    const validation = skillFrontmatterSchema.safeParse(input.frontmatter);
    if (!validation.success) {
      throw new AppError("VALIDATION_ERROR", validation.error.message, 400);
    }

    const skillPath = `skills/${input.name}/SKILL.md`;
    const exists = await this.provider.exists(skillPath);
    if (exists) {
      throw new AppError("DUPLICATE", `Skill '${input.name}' already exists`, 409);
    }

    const content = matter.stringify(input.body, input.frontmatter);
    await this.provider.writeFile(skillPath, content);

    return this.parseSkill(input.name, skillPath);
  }

  async update(name: string, input: UpdateSkillInput): Promise<Skill> {
    const skillPath = `skills/${name}/SKILL.md`;
    const exists = await this.provider.exists(skillPath);
    if (!exists) {
      throw new AppError("FILE_NOT_FOUND", `Skill '${name}' not found`, 404, skillPath);
    }

    const validation = skillFrontmatterSchema.safeParse(input.frontmatter);
    if (!validation.success) {
      throw new AppError("VALIDATION_ERROR", validation.error.message, 400);
    }

    const content = matter.stringify(input.body, input.frontmatter);
    await this.provider.writeFile(skillPath, content);

    return this.parseSkill(name, skillPath);
  }

  async delete(name: string): Promise<void> {
    const skillDir = `skills/${name}`;
    const exists = await this.provider.exists(skillDir);
    if (!exists) {
      throw new AppError("FILE_NOT_FOUND", `Skill '${name}' not found`, 404);
    }
    await this.provider.deleteDirectory(skillDir);
  }

  private async parseSkill(name: string, skillPath: string): Promise<Skill> {
    const raw = await this.provider.readFile(skillPath);
    const parsed = matter(raw);
    const lastModified = await this.provider.getLastModified(skillPath);

    return {
      name,
      frontmatter: parsed.data as SkillFrontmatter,
      body: parsed.content.trim(),
      source: "custom",
      filePath: skillPath,
      lastModified: lastModified.toISOString(),
    };
  }
}
