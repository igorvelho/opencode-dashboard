import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";
import { v4 as uuidv4 } from "uuid";
import { Workspace } from "../../../shared/types";

const DATA_DIR = path.join(__dirname, "../../data");
const WORKSPACES_FILE = path.join(DATA_DIR, "workspaces.json");

function getDefaultConfigPath(): string {
  if (process.env.OPENCODE_CONFIG_DIR) {
    return process.env.OPENCODE_CONFIG_DIR;
  }
  return path.join(os.homedir(), ".config", "opencode");
}

export class WorkspaceService {
  private async ensureDataDir(): Promise<void> {
    await fs.mkdir(DATA_DIR, { recursive: true });
  }

  private async readWorkspaces(): Promise<Workspace[]> {
    await this.ensureDataDir();
    try {
      const content = await fs.readFile(WORKSPACES_FILE, "utf-8");
      return JSON.parse(content);
    } catch {
      const defaultWorkspace: Workspace = {
        id: uuidv4(),
        name: "Default",
        configPath: getDefaultConfigPath(),
        providerType: "local",
        createdAt: new Date().toISOString(),
      };
      await this.writeWorkspaces([defaultWorkspace]);
      return [defaultWorkspace];
    }
  }

  private async writeWorkspaces(workspaces: Workspace[]): Promise<void> {
    await this.ensureDataDir();
    await fs.writeFile(WORKSPACES_FILE, JSON.stringify(workspaces, null, 2));
  }

  async list(): Promise<Workspace[]> {
    return this.readWorkspaces();
  }

  async get(id: string): Promise<Workspace | undefined> {
    const workspaces = await this.readWorkspaces();
    return workspaces.find((w) => w.id === id);
  }

  async create(name: string, configPath: string): Promise<Workspace> {
    const workspaces = await this.readWorkspaces();
    const workspace: Workspace = {
      id: uuidv4(),
      name,
      configPath: path.resolve(configPath),
      providerType: "local",
      createdAt: new Date().toISOString(),
    };
    workspaces.push(workspace);
    await this.writeWorkspaces(workspaces);
    return workspace;
  }

  async delete(id: string): Promise<boolean> {
    const workspaces = await this.readWorkspaces();
    const filtered = workspaces.filter((w) => w.id !== id);
    if (filtered.length === workspaces.length) return false;
    await this.writeWorkspaces(filtered);
    return true;
  }
}
