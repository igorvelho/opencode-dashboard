import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";
import { v4 as uuidv4 } from "uuid";
import { Workspace } from "../../../shared/types";
import { AppError } from "../middleware/errorHandler";

const DATA_DIR = path.join(__dirname, "../../data");
const WORKSPACES_FILE = path.join(DATA_DIR, "workspaces.json");

function getDefaultConfigPath(): string {
  if (process.env.OPENCODE_CONFIG_DIR) {
    return process.env.OPENCODE_CONFIG_DIR;
  }
  return path.join(os.homedir(), ".config", "opencode");
}

/** Detect if running inside WSL */
function isWSL(): boolean {
  try {
    const release = require("fs").readFileSync("/proc/version", "utf-8");
    return /microsoft/i.test(release);
  } catch {
    return false;
  }
}

/** Match Windows absolute paths like C:\ or D:/ */
const WIN_PATH_RE = /^([A-Za-z]):[/\\]/;

/**
 * Normalize a config path for the current platform.
 * - On WSL, converts Windows paths (C:\Users\...) to /mnt/c/Users/...
 * - Relative paths are resolved against CWD (Linux) or stored as-is (Windows)
 * - Already-absolute POSIX paths are kept as-is
 */
function normalizeConfigPath(inputPath: string): string {
  const trimmed = inputPath.trim();
  const winMatch = trimmed.match(WIN_PATH_RE);

  if (winMatch) {
    // Windows-style absolute path
    if (isWSL()) {
      // Convert C:\Users\foo → /mnt/c/Users/foo
      const driveLetter = winMatch[1].toLowerCase();
      const rest = trimmed.slice(2).replace(/\\/g, "/"); // strip "C:" and normalize separators
      return `/mnt/${driveLetter}${rest}`;
    }
    // On actual Windows, path.resolve handles it correctly
    return path.resolve(trimmed);
  }

  if (path.isAbsolute(trimmed)) {
    // Already an absolute POSIX path — keep as-is
    return trimmed;
  }

  // Relative path — resolve against CWD
  return path.resolve(trimmed);
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
    const resolved = normalizeConfigPath(configPath);

    // Validate that the path is accessible
    try {
      await fs.access(resolved);
    } catch {
      throw new AppError(
        "PATH_NOT_ACCESSIBLE",
        `Config path is not accessible: ${resolved}` +
          (WIN_PATH_RE.test(configPath.trim()) && isWSL()
            ? ` (converted from Windows path "${configPath.trim()}")`
            : ""),
        400
      );
    }

    const workspaces = await this.readWorkspaces();
    const workspace: Workspace = {
      id: uuidv4(),
      name,
      configPath: resolved,
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

  /**
   * Discover OpenCode config directories that exist on this system.
   * Checks common locations and returns paths that are accessible,
   * excluding any that are already registered as workspaces.
   */
  async discover(): Promise<{ path: string; label: string }[]> {
    const existing = await this.readWorkspaces();
    const existingPaths = new Set(existing.map((w) => w.configPath));

    const candidates: { path: string; label: string }[] = [];

    // 1. XDG_CONFIG_HOME or ~/.config/opencode (Linux/WSL default)
    const xdg = process.env.XDG_CONFIG_HOME;
    if (xdg) {
      candidates.push({
        path: path.join(xdg, "opencode"),
        label: "Linux ($XDG_CONFIG_HOME)",
      });
    }
    const linuxDefault = path.join(os.homedir(), ".config", "opencode");
    // Only add if different from XDG candidate
    if (!xdg || path.join(xdg, "opencode") !== linuxDefault) {
      candidates.push({ path: linuxDefault, label: "Linux (default)" });
    }

    // 2. OPENCODE_CONFIG_DIR env var
    if (process.env.OPENCODE_CONFIG_DIR) {
      const envPath = process.env.OPENCODE_CONFIG_DIR;
      if (!candidates.some((c) => c.path === envPath)) {
        candidates.push({ path: envPath, label: "OPENCODE_CONFIG_DIR" });
      }
    }

    // 3. Windows config via WSL mount
    if (isWSL()) {
      try {
        // Find Windows username(s) under /mnt/c/Users
        const usersDir = "/mnt/c/Users";
        const entries = await fs.readdir(usersDir, { withFileTypes: true });
        for (const entry of entries) {
          if (
            entry.isDirectory() &&
            !["Public", "Default", "Default User", "All Users"].includes(entry.name)
          ) {
            const winConfig = path.join(usersDir, entry.name, ".config", "opencode");
            if (!candidates.some((c) => c.path === winConfig)) {
              candidates.push({
                path: winConfig,
                label: `Windows (${entry.name})`,
              });
            }
          }
        }
      } catch {
        // /mnt/c/Users not accessible — skip
      }
    }

    // Filter to paths that exist and aren't already registered
    const results: { path: string; label: string }[] = [];
    for (const candidate of candidates) {
      if (existingPaths.has(candidate.path)) continue;
      try {
        await fs.access(candidate.path);
        // Verify it has an opencode.json to confirm it's a real config dir
        await fs.access(path.join(candidate.path, "opencode.json"));
        results.push(candidate);
      } catch {
        // Path doesn't exist or no opencode.json — skip
      }
    }

    return results;
  }
}
