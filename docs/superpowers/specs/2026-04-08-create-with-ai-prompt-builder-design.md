# Create with AI -- Prompt Builder

**Date:** 2026-04-08
**Status:** Draft
**Scope:** Skills, Commands, Agents

## Summary

Add a "Create with AI" button to the skill, command, and agent list pages. Clicking it opens a dialog where the user describes what they want in free text. The dashboard assembles a structured prompt -- including file format, file path, existing entity names, and constraints -- and offers a copy-to-clipboard button. The user pastes the prompt into their running OpenCode CLI session, which handles the actual creation.

The dashboard is a **prompt builder**, not an AI runtime. Zero LLM calls, zero server changes.

## Motivation

OpenCode CLI already supports chat-based entity creation -- you describe what you want and it creates the file. But crafting a good prompt requires knowing the file format, frontmatter schema, directory conventions, and what already exists. The dashboard has all this context. By assembling the prompt for the user, we bridge the dashboard's structural knowledge with the CLI's generative capability.

## Scope

### In scope

- Skills, commands, and agents (file-based entities)
- "Create with AI" button on each list page
- Dialog with entity explainer text + free-text input
- Client-side prompt generation with copy-to-clipboard
- Entity descriptions/explainers for each type

### Out of scope

- MCP servers and providers (JSON-config entities, not suited to free-text generation)
- Direct LLM API calls from the dashboard
- OpenCode CLI subprocess execution
- Editing existing entities via AI prompts

## UI Design

### Trigger

A "Create with AI" button on `SkillList`, `CommandList`, and `AgentList` pages, placed next to the existing "New [Entity]" button. Uses a sparkle/wand icon (e.g., `Sparkles` from lucide-react) to differentiate it visually.

### Dialog -- Input State

The dialog contains, top to bottom:

1. **Entity explainer** -- a brief, friendly explanation block (see Entity Descriptions below)
2. **Free-text textarea** -- placeholder: "Describe the [skill/command/agent] you want to create..."
3. **Action buttons** -- "Generate Prompt" (primary, disabled until text is entered) and "Cancel"

### Dialog -- Copied State

After clicking "Generate Prompt":

- The dialog content swaps to a success state
- A "Copy to Clipboard" button is prominently displayed
- On copy, a toast confirms: "Prompt copied! Paste it into your OpenCode session."
- A "Generate Another" button resets the dialog to the input state

### No prompt preview

The generated prompt is not shown to the user. The dialog goes straight from "Generate Prompt" to "Copy to Clipboard". The prompt is an implementation detail -- the user's job is to describe what they want, not to review the structural scaffolding.

## Entity Descriptions

Displayed at the top of the dialog as contextual help. Stored in a separate module for easy updates.

**Skills:**
> Skills are specialized instruction sets that guide AI behavior for specific tasks. Use them when you want the AI to follow a particular workflow -- like TDD, debugging, code review, or any repeatable process. A skill is loaded on demand and tells the AI HOW to approach a task.

**Commands:**
> Commands are reusable prompt templates you can invoke with a slash (e.g., `/review`). Use them for common tasks you repeat often -- like reviewing code, generating tests, or explaining a file. A command can specify which agent and model to use.

**Agents:**
> Agents are AI personas with specific roles, models, and tool permissions. Use them when you need specialized behavior -- like a "researcher" agent that only reads files, or a "coder" agent with full tool access and a specific system prompt.

## Prompt Template Structure

Each entity type has a prompt-building function. The generated prompt follows this structure:

1. **Role instruction** -- "Create a new [entity type] for OpenCode."
2. **User's description** -- what they typed in the dialog, verbatim.
3. **File format spec** -- the exact frontmatter fields (required/optional), their types, and the body format (markdown).
4. **File location** -- the full path where the file should be written (e.g., `~/.config/opencode/skills/<name>/SKILL.md`).
5. **Existing entities** -- "These [entity type]s already exist: X, Y, Z" so the AI avoids naming conflicts and can follow conventions. Omitted if none exist.
6. **Constraints** -- naming conventions (kebab-case for skills, kebab-case for commands/agents), no overwriting existing files.

### Skill prompt template

```
Create a new OpenCode skill.

I want: {userDescription}

Write it as a markdown file with YAML frontmatter at:
{configPath}/skills/<name>/SKILL.md

Frontmatter fields:
- name (required): kebab-case identifier, used as the directory name
- description (required): one-line summary of when to use this skill
- license (optional): e.g., MIT

The body is the skill's full instruction content in markdown.

Existing skills: {comma-separated list of existing skill names}
Use these as reference for style and structure.

Do not overwrite any existing skill. Use kebab-case for the name and directory.
```

### Command prompt template

```
Create a new OpenCode command.

I want: {userDescription}

Write it as a markdown file with YAML frontmatter at:
{configPath}/commands/<name>.md

Frontmatter fields:
- description (required): one-line summary of what this command does
- agent (optional): which agent should handle this command
- model (optional): which model to use
- subtask (optional): boolean, whether to run as a subtask

The body is the command's prompt template in markdown.

Existing commands: {comma-separated list of existing command names}
Use these as reference for style and structure.

Do not overwrite any existing command. Use kebab-case for the filename.
```

### Agent prompt template

```
Create a new OpenCode agent.

I want: {userDescription}

Write it as a markdown file with YAML frontmatter at:
{configPath}/agents/<name>.md

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

Existing agents: {comma-separated list of existing agent names}
Use these as reference for style and structure.

Do not overwrite any existing agent. Use kebab-case for the filename.
```

## Architecture

### Approach: Client-only

All logic lives in the client. No new server endpoints, routes, or services.

### New files

| File | Purpose |
|---|---|
| `client/src/components/shared/CreateWithAIDialog.tsx` | Reusable dialog component. Accepts entity type, entity list, and config path as props. Manages input/copied state transitions. |
| `client/src/lib/promptBuilder.ts` | Pure functions for prompt assembly. `buildSkillPrompt()`, `buildCommandPrompt()`, `buildAgentPrompt()`, plus a `buildPrompt()` wrapper that dispatches by entity type. |
| `client/src/lib/entityDescriptions.ts` | Explainer text constants for each entity type. |

### Modified files

| File | Change |
|---|---|
| `client/src/pages/skills/SkillList.tsx` | Add "Create with AI" button, render `CreateWithAIDialog` |
| `client/src/pages/commands/CommandList.tsx` | Same |
| `client/src/pages/agents/AgentList.tsx` | Same |

### Data flow

1. User clicks "Create with AI" on a list page (e.g., `SkillList`)
2. `CreateWithAIDialog` opens, showing the skill explainer and a textarea
3. User types a description, clicks "Generate Prompt"
4. `buildSkillPrompt()` is called with:
   - `userDescription`: the free-text input
   - `existingEntities`: list of skill names (already loaded by `useResource` in the parent)
   - `configPath`: workspace config path (from workspace context, already available in the app)
5. The returned prompt string is stored in component state
6. Dialog transitions to the copied state with "Copy to Clipboard" button
7. User clicks copy, toast confirms, user pastes into OpenCode

### Config path access

The workspace context (including `configPath`) is already available in the app -- the sidebar footer displays it. The list pages pass it to the dialog as a prop.

## Edge Cases

| Case | Handling |
|---|---|
| Empty description | "Generate Prompt" button is disabled until text is entered |
| No existing entities | The "Existing [entities]" line is omitted from the prompt |
| Large number of existing entities | All names are listed (comma-separated names only, not full contents) |
| Config path unavailable | Fall back to `~/.config/opencode` |
| Vague user description | Pass through as-is. The AI in OpenCode will ask follow-ups if needed. |
| Clipboard API unavailable | Fall back to `document.execCommand('copy')` or show a selectable text field |

## Testing

- **Prompt builder functions** are pure (string in, string out) -- straightforward to unit test. Verify correct interpolation for each entity type, omission of "Existing entities" when list is empty, and correct file paths.
- **No server tests needed** -- zero server changes.
- **Manual testing** -- verify the dialog flow on each list page: open, type, generate, copy, paste into OpenCode, confirm the AI understands the prompt and creates the correct file.
