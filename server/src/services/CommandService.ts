import matter from "gray-matter";
import { ConfigProvider } from "./ConfigProvider";
import { Command, CommandFrontmatter } from "../../../shared/types";
import { commandFrontmatterSchema } from "../../../shared/schemas";
import { AppError } from "../middleware/errorHandler";

interface CreateCommandInput {
  name: string;
  frontmatter: CommandFrontmatter;
  body: string;
}

interface UpdateCommandInput {
  frontmatter: CommandFrontmatter;
  body: string;
}

export class CommandService {
  constructor(private provider: ConfigProvider) {}

  async list(): Promise<Command[]> {
    const fileCommands = await this.listFileCommands();
    const jsonCommands = await this.listJsonCommands();

    // Merge: file commands take precedence over JSON commands with same name
    const merged = new Map<string, Command>();
    for (const cmd of jsonCommands) {
      merged.set(cmd.name, cmd);
    }
    for (const cmd of fileCommands) {
      merged.set(cmd.name, cmd);
    }

    return Array.from(merged.values());
  }

  async get(name: string): Promise<Command | undefined> {
    // Check file commands first
    const fileCmd = await this.getFileCommand(name);
    if (fileCmd) return fileCmd;

    // Fall back to JSON commands
    const jsonCommands = await this.listJsonCommands();
    return jsonCommands.find((c) => c.name === name);
  }

  async create(input: CreateCommandInput): Promise<Command> {
    const validation = commandFrontmatterSchema.safeParse(input.frontmatter);
    if (!validation.success) {
      throw new AppError("VALIDATION_ERROR", validation.error.message, 400);
    }

    const cmdPath = `commands/${input.name}.md`;
    const exists = await this.provider.exists(cmdPath);
    if (exists) {
      throw new AppError("DUPLICATE", `Command '${input.name}' already exists`, 409);
    }

    const content = matter.stringify(input.body, input.frontmatter);
    await this.provider.writeFile(cmdPath, content);

    return this.parseFileCommand(input.name, cmdPath);
  }

  async update(name: string, input: UpdateCommandInput): Promise<Command> {
    const cmdPath = `commands/${name}.md`;
    const exists = await this.provider.exists(cmdPath);
    if (!exists) {
      throw new AppError("FILE_NOT_FOUND", `Command '${name}' not found`, 404, cmdPath);
    }

    const validation = commandFrontmatterSchema.safeParse(input.frontmatter);
    if (!validation.success) {
      throw new AppError("VALIDATION_ERROR", validation.error.message, 400);
    }

    const content = matter.stringify(input.body, input.frontmatter);
    await this.provider.writeFile(cmdPath, content);

    return this.parseFileCommand(name, cmdPath);
  }

  async delete(name: string): Promise<void> {
    const cmdPath = `commands/${name}.md`;
    const exists = await this.provider.exists(cmdPath);
    if (!exists) {
      // Check if it's a JSON command
      const jsonCommands = await this.listJsonCommands();
      const isJson = jsonCommands.some((c) => c.name === name);
      if (isJson) {
        throw new AppError(
          "READ_ONLY",
          `Command '${name}' is defined in opencode.json and cannot be deleted from the dashboard`,
          403
        );
      }
      throw new AppError("FILE_NOT_FOUND", `Command '${name}' not found`, 404);
    }
    await this.provider.deleteFile(cmdPath);
  }

  private async listFileCommands(): Promise<Command[]> {
    const commandsDir = "commands";
    const dirExists = await this.provider.exists(commandsDir);
    if (!dirExists) return [];

    const entries = await this.provider.listDirectory(commandsDir);
    const commands: Command[] = [];

    for (const entry of entries) {
      if (!entry.endsWith(".md")) continue;
      const name = entry.replace(/\.md$/, "");
      const cmdPath = `${commandsDir}/${entry}`;
      try {
        const cmd = await this.parseFileCommand(name, cmdPath);
        commands.push(cmd);
      } catch {
        // Skip malformed commands
      }
    }

    return commands;
  }

  private async getFileCommand(name: string): Promise<Command | undefined> {
    const cmdPath = `commands/${name}.md`;
    const exists = await this.provider.exists(cmdPath);
    if (!exists) return undefined;
    return this.parseFileCommand(name, cmdPath);
  }

  private async listJsonCommands(): Promise<Command[]> {
    const commands: Command[] = [];

    try {
      const raw = await this.provider.readFile("opencode.json");
      const config = JSON.parse(raw);
      const commandSection = config.command || {};

      for (const [name, def] of Object.entries(commandSection)) {
        const cmdDef = def as Record<string, unknown>;
        commands.push({
          name,
          frontmatter: {
            description: (cmdDef.description as string) || "",
            agent: cmdDef.agent as string | undefined,
            model: cmdDef.model as string | undefined,
            subtask: cmdDef.subtask as boolean | undefined,
          },
          body: (cmdDef.template as string) || "",
          source: "json",
          lastModified: new Date().toISOString(),
        });
      }
    } catch {
      // No opencode.json or invalid JSON - that's fine
    }

    return commands;
  }

  private async parseFileCommand(name: string, cmdPath: string): Promise<Command> {
    const raw = await this.provider.readFile(cmdPath);
    const parsed = matter(raw);
    const lastModified = await this.provider.getLastModified(cmdPath);

    return {
      name,
      frontmatter: parsed.data as CommandFrontmatter,
      body: parsed.content.trim(),
      source: "file",
      filePath: cmdPath,
      lastModified: lastModified.toISOString(),
    };
  }
}
