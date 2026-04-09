// ── Workspace ──
export interface Workspace {
  id: string;
  name: string;
  configPath: string;
  providerType: "local";
  createdAt: string;
}

// ── Skills ──
export interface SkillFrontmatter {
  name: string;
  description: string;
  license?: string;
  compatibility?: string;
  metadata?: Record<string, string>;
}

export interface Skill {
  name: string;
  frontmatter: SkillFrontmatter;
  body: string;
  source: "custom" | "plugin";
  filePath: string;
  lastModified: string;
}

// ── Commands ──
export interface CommandFrontmatter {
  description: string;
  agent?: string;
  model?: string;
  subtask?: boolean;
}

export interface Command {
  name: string;
  frontmatter: CommandFrontmatter;
  body: string;
  source: "file" | "json";
  filePath?: string;
  lastModified: string;
}

// ── Agents ──
export interface AgentFrontmatter {
  description: string;
  mode?: "primary" | "subagent" | "all";
  model?: string;
  temperature?: number;
  steps?: number;
  tools?: Record<string, boolean>;
  permission?: Record<string, unknown>;
  color?: string;
  top_p?: number;
  hidden?: boolean;
  disable?: boolean;
  [key: string]: unknown; // pass-through fields for provider options
}

export interface Agent {
  name: string;
  frontmatter: AgentFrontmatter;
  body: string;
  source: "file" | "json";
  filePath?: string;
  lastModified: string;
}

// ── MCP Servers ──
export interface McpServerLocal {
  type: "local";
  command: string[];
  environment?: Record<string, string>;
  enabled?: boolean;
  timeout?: number;
}

export interface McpServerRemote {
  type: "remote";
  url: string;
  headers?: Record<string, string>;
  oauth?: Record<string, unknown> | false;
  enabled?: boolean;
  timeout?: number;
}

export type McpServerConfig = McpServerLocal | McpServerRemote;

export interface McpServer {
  name: string;
  config: McpServerConfig;
  lastModified: string;
}

// ── Providers & Models ──
export interface ModelConfig {
  options?: Record<string, unknown>;
  variants?: Record<string, Record<string, unknown>>;
}

export interface ProviderConfig {
  options?: Record<string, unknown>;
  models?: Record<string, ModelConfig>;
  [key: string]: unknown;
}

export interface Provider {
  name: string;
  config: ProviderConfig;
  lastModified: string;
}

// ── Backup ──
export type BackupSection = "skills" | "commands" | "agents" | "mcpServers" | "providers" | "config";

export const ALL_BACKUP_SECTIONS: BackupSection[] = [
  "skills",
  "commands",
  "agents",
  "mcpServers",
  "providers",
  "config",
];

export interface BackupManifest {
  timestamp: string;
  redacted: boolean;
  redactedFields: string[];
  sections: BackupSection[];
  files: Array<{ path: string; checksum: string }>;
}

export interface BackupEntry {
  filename: string;
  timestamp: string;
  redacted: boolean;
  sections: BackupSection[];
  size: number;
}

// ── API Errors ──
export interface ApiError {
  error: {
    code: string;
    message: string;
    path?: string;
  };
}

// ── Metrics ──
export type TimeRange = '7d' | '30d' | 'current-month' | 'all';

export interface MetricsProject {
  id: string;
  name: string;
}

export interface DailyMetric {
  date: string;
  cost: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
}

export interface ModelMetric {
  modelId: string;
  providerId: string;
  cost: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  messageCount: number;
}

export interface DailyModelCost {
  date: string;
  modelId: string;
  cost: number;
}

export interface MetricsSummary {
  totalCost: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCacheRead: number;
  totalCacheWrite: number;
  totalSessions: number;
  totalMessages: number;
  daily: DailyMetric[];
  models: ModelMetric[];
  dailyByModel: DailyModelCost[];
}
