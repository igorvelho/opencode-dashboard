import matter from "gray-matter";
import { ConfigProvider } from "./ConfigProvider";
import { Agent, AgentFrontmatter } from "../../../shared/types";
import { agentFrontmatterSchema } from "../../../shared/schemas";
import { AppError } from "../middleware/errorHandler";

interface CreateAgentInput {
  name: string;
  frontmatter: AgentFrontmatter;
  body: string;
}

interface UpdateAgentInput {
  frontmatter: AgentFrontmatter;
  body: string;
}

export class AgentService {
  constructor(private provider: ConfigProvider) {}

  async list(): Promise<Agent[]> {
    const fileAgents = await this.listFileAgents();
    const jsonAgents = await this.listJsonAgents();

    // Merge: file agents take precedence over JSON agents with same name
    const merged = new Map<string, Agent>();
    for (const agent of jsonAgents) {
      merged.set(agent.name, agent);
    }
    for (const agent of fileAgents) {
      merged.set(agent.name, agent);
    }

    return Array.from(merged.values());
  }

  async get(name: string): Promise<Agent | undefined> {
    const fileAgent = await this.getFileAgent(name);
    if (fileAgent) return fileAgent;

    const jsonAgents = await this.listJsonAgents();
    return jsonAgents.find((a) => a.name === name);
  }

  async create(input: CreateAgentInput): Promise<Agent> {
    const validation = agentFrontmatterSchema.safeParse(input.frontmatter);
    if (!validation.success) {
      throw new AppError("VALIDATION_ERROR", validation.error.message, 400);
    }

    const agentPath = `agents/${input.name}.md`;
    const exists = await this.provider.exists(agentPath);
    if (exists) {
      throw new AppError("DUPLICATE", `Agent '${input.name}' already exists`, 409);
    }

    const content = matter.stringify(input.body, input.frontmatter);
    await this.provider.writeFile(agentPath, content);

    return this.parseFileAgent(input.name, agentPath);
  }

  async update(name: string, input: UpdateAgentInput): Promise<Agent> {
    const agentPath = `agents/${name}.md`;
    const exists = await this.provider.exists(agentPath);
    if (!exists) {
      throw new AppError("FILE_NOT_FOUND", `Agent '${name}' not found`, 404, agentPath);
    }

    const validation = agentFrontmatterSchema.safeParse(input.frontmatter);
    if (!validation.success) {
      throw new AppError("VALIDATION_ERROR", validation.error.message, 400);
    }

    const content = matter.stringify(input.body, input.frontmatter);
    await this.provider.writeFile(agentPath, content);

    return this.parseFileAgent(name, agentPath);
  }

  async delete(name: string): Promise<void> {
    const agentPath = `agents/${name}.md`;
    const exists = await this.provider.exists(agentPath);
    if (!exists) {
      const jsonAgents = await this.listJsonAgents();
      const isJson = jsonAgents.some((a) => a.name === name);
      if (isJson) {
        throw new AppError(
          "READ_ONLY",
          `Agent '${name}' is defined in opencode.json and cannot be deleted from the dashboard`,
          403
        );
      }
      throw new AppError("FILE_NOT_FOUND", `Agent '${name}' not found`, 404);
    }
    await this.provider.deleteFile(agentPath);
  }

  private async listFileAgents(): Promise<Agent[]> {
    const agentsDir = "agents";
    const dirExists = await this.provider.exists(agentsDir);
    if (!dirExists) return [];

    const entries = await this.provider.listDirectory(agentsDir);
    const agents: Agent[] = [];

    for (const entry of entries) {
      if (!entry.endsWith(".md")) continue;
      const name = entry.replace(/\.md$/, "");
      const agentPath = `${agentsDir}/${entry}`;
      try {
        const agent = await this.parseFileAgent(name, agentPath);
        agents.push(agent);
      } catch {
        // Skip malformed agents
      }
    }

    return agents;
  }

  private async getFileAgent(name: string): Promise<Agent | undefined> {
    const agentPath = `agents/${name}.md`;
    const exists = await this.provider.exists(agentPath);
    if (!exists) return undefined;
    return this.parseFileAgent(name, agentPath);
  }

  private async listJsonAgents(): Promise<Agent[]> {
    const agents: Agent[] = [];

    try {
      const raw = await this.provider.readFile("opencode.json");
      const config = JSON.parse(raw);
      const agentSection = config.agent || {};

      for (const [name, def] of Object.entries(agentSection)) {
        const agentDef = def as Record<string, unknown>;
        agents.push({
          name,
          frontmatter: {
            description: (agentDef.description as string) || "",
            mode: agentDef.mode as AgentFrontmatter["mode"],
            model: agentDef.model as string | undefined,
            temperature: agentDef.temperature as number | undefined,
            steps: agentDef.steps as number | undefined,
            tools: agentDef.tools as Record<string, boolean> | undefined,
            permission: agentDef.permission as Record<string, unknown> | undefined,
            color: agentDef.color as string | undefined,
            top_p: agentDef.top_p as number | undefined,
            hidden: agentDef.hidden as boolean | undefined,
            disable: agentDef.disable as boolean | undefined,
          },
          body: (agentDef.system as string) || "",
          source: "json",
          lastModified: new Date().toISOString(),
        });
      }
    } catch {
      // No opencode.json or invalid JSON - that's fine
    }

    return agents;
  }

  private async parseFileAgent(name: string, agentPath: string): Promise<Agent> {
    const raw = await this.provider.readFile(agentPath);
    const parsed = matter(raw);
    const lastModified = await this.provider.getLastModified(agentPath);

    return {
      name,
      frontmatter: parsed.data as AgentFrontmatter,
      body: parsed.content.trim(),
      source: "file",
      filePath: agentPath,
      lastModified: lastModified.toISOString(),
    };
  }
}
