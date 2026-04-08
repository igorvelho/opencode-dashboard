// client/src/lib/promptBuilder.ts

import type { EntityType } from "./entityDescriptions";

export interface PromptOptions {
  userDescription: string;
  existingNames: string[];
  configPath: string;
}

export function buildSkillPrompt({
  userDescription,
  existingNames,
  configPath,
}: PromptOptions): string {
  const existingLine =
    existingNames.length > 0
      ? `\nExisting skills: ${existingNames.join(", ")}\nUse these as reference for style and structure.\n`
      : "";

  return `Create a new OpenCode skill.

I want: ${userDescription}

Write it as a markdown file with YAML frontmatter at:
${configPath}/skills/<name>/SKILL.md

Frontmatter fields:
- name (required): kebab-case identifier, used as the directory name
- description (required): one-line summary of when to use this skill
- license (optional): e.g., MIT
${existingLine}
Do not overwrite any existing skill. Use kebab-case for the name and directory.`;
}

export function buildCommandPrompt({
  userDescription,
  existingNames,
  configPath,
}: PromptOptions): string {
  const existingLine =
    existingNames.length > 0
      ? `\nExisting commands: ${existingNames.join(", ")}\nUse these as reference for style and structure.\n`
      : "";

  return `Create a new OpenCode command.

I want: ${userDescription}

Write it as a markdown file with YAML frontmatter at:
${configPath}/commands/<name>.md

Frontmatter fields:
- description (required): one-line summary of what this command does
- agent (optional): which agent should handle this command
- model (optional): which model to use
- subtask (optional): boolean, whether to run as a subtask

The body is the command's prompt template in markdown.
${existingLine}
Do not overwrite any existing command. Use kebab-case for the filename.`;
}

export function buildAgentPrompt({
  userDescription,
  existingNames,
  configPath,
}: PromptOptions): string {
  const existingLine =
    existingNames.length > 0
      ? `\nExisting agents: ${existingNames.join(", ")}\nUse these as reference for style and structure.\n`
      : "";

  return `Create a new OpenCode agent.

I want: ${userDescription}

Write it as a markdown file with YAML frontmatter at:
${configPath}/agents/<name>.md

Frontmatter fields:
- description (required): one-line summary of this agent's role
- model (optional): which model this agent uses
- mode (optional): "primary", "subagent", or "all"
- temperature (optional): number between 0 and 1
- tools (optional): list of tools this agent can use
- permission (optional): tool permission level
- color (optional): display color
- top_p (optional): number between 0 and 1

The body is the agent's system prompt in markdown.
${existingLine}
Do not overwrite any existing agent. Use kebab-case for the filename.`;
}

export function buildPrompt(
  entityType: EntityType,
  options: PromptOptions
): string {
  switch (entityType) {
    case "skill":
      return buildSkillPrompt(options);
    case "command":
      return buildCommandPrompt(options);
    case "agent":
      return buildAgentPrompt(options);
  }
}
