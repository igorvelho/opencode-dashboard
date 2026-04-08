import { ConfigProvider } from "./ConfigProvider";
import { ConfigService } from "./ConfigService";
import { McpServer, McpServerConfig } from "../../../shared/types";
import { mcpServerConfigSchema } from "../../../shared/schemas";
import { AppError } from "../middleware/errorHandler";

export class McpServerService {
  private configService: ConfigService;

  constructor(private provider: ConfigProvider) {
    this.configService = new ConfigService(provider);
  }

  async list(): Promise<McpServer[]> {
    const mcpSection = await this.configService.getSection("mcp");
    const servers: McpServer[] = [];
    let lastModified: string;

    try {
      const mod = await this.provider.getLastModified("opencode.json");
      lastModified = mod.toISOString();
    } catch {
      lastModified = new Date().toISOString();
    }

    for (const [name, config] of Object.entries(mcpSection)) {
      servers.push({
        name,
        config: config as McpServerConfig,
        lastModified,
      });
    }

    return servers;
  }

  async get(name: string): Promise<McpServer | undefined> {
    const mcpSection = await this.configService.getSection("mcp");
    const config = mcpSection[name];
    if (!config) return undefined;

    let lastModified: string;
    try {
      const mod = await this.provider.getLastModified("opencode.json");
      lastModified = mod.toISOString();
    } catch {
      lastModified = new Date().toISOString();
    }

    return {
      name,
      config: config as McpServerConfig,
      lastModified,
    };
  }

  async create(name: string, config: McpServerConfig): Promise<McpServer> {
    const validation = mcpServerConfigSchema.safeParse(config);
    if (!validation.success) {
      throw new AppError("VALIDATION_ERROR", validation.error.message, 400);
    }

    const mcpSection = await this.configService.getSection("mcp");
    if (mcpSection[name]) {
      throw new AppError("DUPLICATE", `MCP server '${name}' already exists`, 409);
    }

    mcpSection[name] = config;
    await this.configService.updateSection("mcp", mcpSection);

    return this.get(name) as Promise<McpServer>;
  }

  async update(name: string, config: McpServerConfig): Promise<McpServer> {
    const validation = mcpServerConfigSchema.safeParse(config);
    if (!validation.success) {
      throw new AppError("VALIDATION_ERROR", validation.error.message, 400);
    }

    const mcpSection = await this.configService.getSection("mcp");
    if (!mcpSection[name]) {
      throw new AppError("NOT_FOUND", `MCP server '${name}' not found`, 404);
    }

    mcpSection[name] = config;
    await this.configService.updateSection("mcp", mcpSection);

    return this.get(name) as Promise<McpServer>;
  }

  async toggle(name: string): Promise<McpServer> {
    const mcpSection = await this.configService.getSection("mcp");
    const existing = mcpSection[name] as McpServerConfig | undefined;
    if (!existing) {
      throw new AppError("NOT_FOUND", `MCP server '${name}' not found`, 404);
    }

    const currentEnabled = existing.enabled !== false; // default to true
    (existing as unknown as Record<string, unknown>).enabled = !currentEnabled;
    mcpSection[name] = existing;
    await this.configService.updateSection("mcp", mcpSection);

    return this.get(name) as Promise<McpServer>;
  }

  async delete(name: string): Promise<void> {
    const mcpSection = await this.configService.getSection("mcp");
    if (!mcpSection[name]) {
      throw new AppError("NOT_FOUND", `MCP server '${name}' not found`, 404);
    }

    delete mcpSection[name];
    await this.configService.updateSection("mcp", mcpSection);
  }
}
