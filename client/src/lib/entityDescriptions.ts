// client/src/lib/entityDescriptions.ts

export type EntityType = "skill" | "command" | "agent";

export const ENTITY_DESCRIPTIONS: Record<EntityType, string> = {
  skill:
    "Skills are specialized instruction sets that guide AI behavior for specific tasks. Use them when you want the AI to follow a particular workflow — like TDD, debugging, code review, or any repeatable process. A skill is loaded on demand and tells the AI HOW to approach a task.",
  command:
    "Commands are reusable prompt templates you can invoke with a slash (e.g., /review). Use them for common tasks you repeat often — like reviewing code, generating tests, or explaining a file. A command can specify which agent and model to use.",
  agent:
    "Agents are AI personas with specific roles, models, and tool permissions. Use them when you need specialized behavior — like a \"researcher\" agent that only reads files, or a \"coder\" agent with full tool access and a specific system prompt.",
};
