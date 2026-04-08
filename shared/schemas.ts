import { z } from "zod";

// Skill name regex from OpenCode docs
const skillNameRegex = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export const skillFrontmatterSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(64)
    .regex(skillNameRegex, "Must be lowercase alphanumeric with single hyphen separators"),
  description: z.string().min(1).max(1024),
  license: z.string().optional(),
  compatibility: z.string().optional(),
  metadata: z.record(z.string(), z.string()).optional(),
});

export const commandFrontmatterSchema = z.object({
  description: z.string().min(1),
  agent: z.string().optional(),
  model: z.string().optional(),
  subtask: z.boolean().optional(),
});

export const agentFrontmatterSchema = z.object({
  description: z.string().min(1),
  mode: z.enum(["primary", "subagent", "all"]).optional(),
  model: z.string().optional(),
  temperature: z.number().min(0).max(1).optional(),
  steps: z.number().int().positive().optional(),
  tools: z.record(z.string(), z.boolean()).optional(),
  permission: z.record(z.string(), z.unknown()).optional(),
  color: z.string().optional(),
  top_p: z.number().min(0).max(1).optional(),
  hidden: z.boolean().optional(),
  disable: z.boolean().optional(),
}).passthrough(); // allow extra fields for provider pass-through

export const mcpServerLocalSchema = z.object({
  type: z.literal("local"),
  command: z.array(z.string()).min(1),
  environment: z.record(z.string(), z.string()).optional(),
  enabled: z.boolean().optional(),
  timeout: z.number().positive().optional(),
});

export const mcpServerRemoteSchema = z.object({
  type: z.literal("remote"),
  url: z.string().url(),
  headers: z.record(z.string(), z.string()).optional(),
  oauth: z.union([z.record(z.string(), z.unknown()), z.literal(false)]).optional(),
  enabled: z.boolean().optional(),
  timeout: z.number().positive().optional(),
});

export const mcpServerConfigSchema = z.discriminatedUnion("type", [
  mcpServerLocalSchema,
  mcpServerRemoteSchema,
]);

export const workspaceCreateSchema = z.object({
  name: z.string().min(1),
  configPath: z.string().min(1),
});
