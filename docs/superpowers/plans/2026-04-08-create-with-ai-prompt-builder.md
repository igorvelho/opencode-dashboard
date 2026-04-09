# Create with AI Prompt Builder — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Create with AI" button to the Skill, Command, and Agent list pages that opens a dialog allowing users to describe what they want; the dialog assembles a structured prompt and provides a copy-to-clipboard button so users can paste it into their OpenCode CLI session.

**Architecture:** Entirely client-side — no server changes. Three new files (`entityDescriptions.ts`, `promptBuilder.ts`, `CreateWithAIDialog.tsx`) plus small additions to the three list pages. The dialog manages two states: input (textarea + Generate) and copied (Copy to Clipboard + Generate Another).

**Tech Stack:** React 19, TypeScript, shadcn/ui Dialog + Button + Textarea, lucide-react Sparkles icon, sonner toast, Clipboard API

---

## File Map

| Action | Path | Purpose |
|---|---|---|
| Create | `client/src/lib/entityDescriptions.ts` | Explainer text constants for skill/command/agent |
| Create | `client/src/lib/promptBuilder.ts` | Pure prompt-building functions for each entity type |
| Create | `client/src/components/shared/CreateWithAIDialog.tsx` | Reusable dialog with input/copied state |
| Modify | `client/src/pages/skills/SkillList.tsx` | Add "Create with AI" button + render dialog |
| Modify | `client/src/pages/commands/CommandList.tsx` | Same |
| Modify | `client/src/pages/agents/AgentList.tsx` | Same |

---

## Task 1: Entity Descriptions Module

**Files:**
- Create: `client/src/lib/entityDescriptions.ts`

- [ ] **Step 1: Create the entity descriptions file**

```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add client/src/lib/entityDescriptions.ts
git commit -m "feat: add entity descriptions module for Create with AI dialog"
```

---

## Task 2: Prompt Builder Module

**Files:**
- Create: `client/src/lib/promptBuilder.ts`

- [ ] **Step 1: Create the prompt builder file**

```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add client/src/lib/promptBuilder.ts
git commit -m "feat: add prompt builder pure functions for skill/command/agent"
```

---

## Task 3: Unit Tests for Prompt Builder

**Files:**
- Create: `client/src/lib/promptBuilder.test.ts`

> Note: The project has no client test setup. These tests go in `server/tests/` if they test shared logic, but since `promptBuilder.ts` is client-only, we will write inline unit tests using the vitest config that already exists in server. Since the prompt builder is pure TypeScript with no imports besides the entity descriptions (which are just constants), we can test the compiled output manually OR we skip client-side unit tests since the spec says "no client tests exist." Per AGENTS.md: "Tests live in `server/tests/`" and "no client tests exist." We verify correctness via manual testing (see manual verification step below).

- [ ] **Step 1: Verify the prompt builder logic is correct by reviewing the output manually**

Run the dev server and open the browser console, then execute:

```javascript
// In browser console after the app loads:
import('/src/lib/promptBuilder.ts').then(m => {
  console.log(m.buildSkillPrompt({
    userDescription: "a TDD workflow guide",
    existingNames: ["brainstorming", "debugging"],
    configPath: "~/.config/opencode"
  }));
});
```

Expected output contains:
- `"Create a new OpenCode skill."`
- `"I want: a TDD workflow guide"`
- `"~/.config/opencode/skills/<name>/SKILL.md"`
- `"Existing skills: brainstorming, debugging"`
- `"Do not overwrite any existing skill."`

Run with empty `existingNames`:

```javascript
import('/src/lib/promptBuilder.ts').then(m => {
  console.log(m.buildSkillPrompt({
    userDescription: "test",
    existingNames: [],
    configPath: "~/.config/opencode"
  }));
});
```

Expected: output does NOT contain `"Existing skills:"`.

- [ ] **Step 2: Verify command and agent prompts similarly**

```javascript
import('/src/lib/promptBuilder.ts').then(m => {
  console.log(m.buildCommandPrompt({
    userDescription: "review my PR",
    existingNames: ["test"],
    configPath: "~/.config/opencode"
  }));
  console.log(m.buildAgentPrompt({
    userDescription: "a researcher agent",
    existingNames: [],
    configPath: "~/.config/opencode"
  }));
});
```

---

## Task 4: CreateWithAIDialog Component

**Files:**
- Create: `client/src/components/shared/CreateWithAIDialog.tsx`

- [ ] **Step 1: Create the dialog component**

```typescript
// client/src/components/shared/CreateWithAIDialog.tsx

import { useState } from "react";
import { toast } from "sonner";
import { Sparkles, Copy, RotateCcw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { EntityType } from "@/lib/entityDescriptions";
import { ENTITY_DESCRIPTIONS } from "@/lib/entityDescriptions";
import { buildPrompt } from "@/lib/promptBuilder";

interface CreateWithAIDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityType: EntityType;
  existingNames: string[];
  configPath: string;
}

type DialogState = "input" | "generated";

export function CreateWithAIDialog({
  open,
  onOpenChange,
  entityType,
  existingNames,
  configPath,
}: CreateWithAIDialogProps) {
  const [state, setState] = useState<DialogState>("input");
  const [description, setDescription] = useState("");
  const [prompt, setPrompt] = useState("");

  const entityLabel =
    entityType === "skill"
      ? "skill"
      : entityType === "command"
        ? "command"
        : "agent";

  function handleOpenChange(open: boolean) {
    if (!open) {
      // Reset state when dialog closes
      setState("input");
      setDescription("");
      setPrompt("");
    }
    onOpenChange(open);
  }

  function handleGenerate() {
    const resolvedConfigPath = configPath || "~/.config/opencode";
    const generated = buildPrompt(entityType, {
      userDescription: description.trim(),
      existingNames,
      configPath: resolvedConfigPath,
    });
    setPrompt(generated);
    setState("generated");
  }

  async function handleCopy() {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(prompt);
      } else {
        // Fallback for environments without Clipboard API
        const textarea = document.createElement("textarea");
        textarea.value = prompt;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      toast.success("Prompt copied! Paste it into your OpenCode session.");
    } catch {
      toast.error("Failed to copy to clipboard");
    }
  }

  function handleGenerateAnother() {
    setState("input");
    setDescription("");
    setPrompt("");
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Create {entityLabel} with AI
          </DialogTitle>
          <DialogDescription>{ENTITY_DESCRIPTIONS[entityType]}</DialogDescription>
        </DialogHeader>

        {state === "input" ? (
          <>
            <Textarea
              placeholder={`Describe the ${entityLabel} you want to create...`}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
              className="resize-none"
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleGenerate}
                disabled={description.trim().length === 0}
              >
                <Sparkles className="mr-2 h-4 w-4" />
                Generate Prompt
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <div className="rounded-lg border border-border bg-muted/50 p-4 text-center space-y-3">
              <p className="text-sm text-muted-foreground">
                Your prompt is ready. Copy it and paste it into your OpenCode session.
              </p>
              <Button onClick={handleCopy} className="w-full" size="lg">
                <Copy className="mr-2 h-4 w-4" />
                Copy to Clipboard
              </Button>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={handleGenerateAnother}>
                <RotateCcw className="mr-2 h-4 w-4" />
                Generate Another
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles without errors**

```bash
npx tsc --noEmit
```

Run from `client/` directory:

```bash
cd /path/to/opencode-dashboard/client && npx tsc --noEmit
```

Expected: no output (clean compile).

- [ ] **Step 3: Commit**

```bash
git add client/src/components/shared/CreateWithAIDialog.tsx
git commit -m "feat: add CreateWithAIDialog component with input/generated state"
```

---

## Task 5: Update SkillList Page

**Files:**
- Modify: `client/src/pages/skills/SkillList.tsx`

- [ ] **Step 1: Add "Create with AI" button and dialog to SkillList**

Replace the contents of `client/src/pages/skills/SkillList.tsx` with:

```typescript
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageLayout } from "@/components/layout/PageLayout";
import { useResource } from "@/hooks/useResource";
import { useWorkspace } from "@/hooks/useWorkspace";
import { SourceBadge } from "@/components/shared/SourceBadge";
import { CreateWithAIDialog } from "@/components/shared/CreateWithAIDialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Sparkles } from "lucide-react";

interface SkillFrontmatter {
  name: string;
  description: string;
  license?: string;
  compatibility?: string;
  metadata?: Record<string, string>;
}

interface Skill {
  name: string;
  frontmatter: SkillFrontmatter;
  body: string;
  source: "custom" | "plugin";
  filePath: string;
  lastModified: string;
}

export function SkillList() {
  const navigate = useNavigate();
  const { items, loading, error } = useResource<Skill>("/skills");
  const { currentWorkspace } = useWorkspace();
  const [aiDialogOpen, setAiDialogOpen] = useState(false);

  return (
    <PageLayout
      title="Skills"
      description="Manage skill definitions"
      actions={
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setAiDialogOpen(true)}>
            <Sparkles className="mr-2 h-4 w-4" />
            Create with AI
          </Button>
          <Button onClick={() => navigate("/skills/new")}>
            <Plus className="mr-2 h-4 w-4" />
            New Skill
          </Button>
        </div>
      }
    >
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
          {error}
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          No skills found. Create your first skill to get started.
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Last Modified</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((skill) => (
              <TableRow
                key={skill.name}
                className="cursor-pointer"
                onClick={() => navigate(`/skills/${encodeURIComponent(skill.name)}`)}
              >
                <TableCell className="font-medium">{skill.name}</TableCell>
                <TableCell className="text-muted-foreground max-w-md truncate">
                  {skill.frontmatter.description}
                </TableCell>
                <TableCell>
                  <SourceBadge source={skill.source} />
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {new Date(skill.lastModified).toLocaleDateString()}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <CreateWithAIDialog
        open={aiDialogOpen}
        onOpenChange={setAiDialogOpen}
        entityType="skill"
        existingNames={items.map((s) => s.name)}
        configPath={currentWorkspace?.configPath ?? "~/.config/opencode"}
      />
    </PageLayout>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles without errors**

```bash
cd /path/to/opencode-dashboard/client && npx tsc --noEmit
```

Expected: no output (clean compile).

- [ ] **Step 3: Commit**

```bash
git add client/src/pages/skills/SkillList.tsx
git commit -m "feat: add Create with AI button to SkillList page"
```

---

## Task 6: Update CommandList Page

**Files:**
- Modify: `client/src/pages/commands/CommandList.tsx`

- [ ] **Step 1: Add "Create with AI" button and dialog to CommandList**

Replace the contents of `client/src/pages/commands/CommandList.tsx` with:

```typescript
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageLayout } from "@/components/layout/PageLayout";
import { useResource } from "@/hooks/useResource";
import { useWorkspace } from "@/hooks/useWorkspace";
import { SourceBadge } from "@/components/shared/SourceBadge";
import { CreateWithAIDialog } from "@/components/shared/CreateWithAIDialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Sparkles } from "lucide-react";

interface CommandFrontmatter {
  description: string;
  agent?: string;
  model?: string;
  subtask?: boolean;
}

interface Command {
  name: string;
  frontmatter: CommandFrontmatter;
  body: string;
  source: "file" | "json";
  filePath?: string;
  lastModified: string;
}

export function CommandList() {
  const navigate = useNavigate();
  const { items, loading, error } = useResource<Command>("/commands");
  const { currentWorkspace } = useWorkspace();
  const [aiDialogOpen, setAiDialogOpen] = useState(false);

  return (
    <PageLayout
      title="Commands"
      description="Manage slash command definitions"
      actions={
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setAiDialogOpen(true)}>
            <Sparkles className="mr-2 h-4 w-4" />
            Create with AI
          </Button>
          <Button onClick={() => navigate("/commands/new")}>
            <Plus className="mr-2 h-4 w-4" />
            New Command
          </Button>
        </div>
      }
    >
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
          {error}
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          No commands found. Create your first command to get started.
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Agent</TableHead>
              <TableHead>Source</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((cmd) => (
              <TableRow
                key={cmd.name}
                className="cursor-pointer"
                onClick={() => navigate(`/commands/${encodeURIComponent(cmd.name)}`)}
              >
                <TableCell className="font-medium">{cmd.name}</TableCell>
                <TableCell className="text-muted-foreground max-w-md truncate">
                  {cmd.frontmatter.description}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {cmd.frontmatter.agent ?? "—"}
                </TableCell>
                <TableCell>
                  <SourceBadge source={cmd.source} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <CreateWithAIDialog
        open={aiDialogOpen}
        onOpenChange={setAiDialogOpen}
        entityType="command"
        existingNames={items.map((c) => c.name)}
        configPath={currentWorkspace?.configPath ?? "~/.config/opencode"}
      />
    </PageLayout>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles without errors**

```bash
cd /path/to/opencode-dashboard/client && npx tsc --noEmit
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add client/src/pages/commands/CommandList.tsx
git commit -m "feat: add Create with AI button to CommandList page"
```

---

## Task 7: Update AgentList Page

**Files:**
- Modify: `client/src/pages/agents/AgentList.tsx`

- [ ] **Step 1: Add "Create with AI" button and dialog to AgentList**

Replace the contents of `client/src/pages/agents/AgentList.tsx` with:

```typescript
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageLayout } from "@/components/layout/PageLayout";
import { useResource } from "@/hooks/useResource";
import { useWorkspace } from "@/hooks/useWorkspace";
import { SourceBadge } from "@/components/shared/SourceBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CreateWithAIDialog } from "@/components/shared/CreateWithAIDialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Sparkles } from "lucide-react";

interface AgentFrontmatter {
  description: string;
  mode?: "primary" | "subagent" | "all";
  model?: string;
  [key: string]: unknown;
}

interface Agent {
  name: string;
  frontmatter: AgentFrontmatter;
  body: string;
  source: "file" | "json";
  filePath?: string;
  lastModified: string;
}

const modeStyles: Record<string, string> = {
  primary: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  subagent: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  all: "bg-green-500/10 text-green-500 border-green-500/20",
};

export function AgentList() {
  const navigate = useNavigate();
  const { items, loading, error } = useResource<Agent>("/agents");
  const { currentWorkspace } = useWorkspace();
  const [aiDialogOpen, setAiDialogOpen] = useState(false);

  return (
    <PageLayout
      title="Agents"
      description="Manage agent configurations"
      actions={
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setAiDialogOpen(true)}>
            <Sparkles className="mr-2 h-4 w-4" />
            Create with AI
          </Button>
          <Button onClick={() => navigate("/agents/new")}>
            <Plus className="mr-2 h-4 w-4" />
            New Agent
          </Button>
        </div>
      }
    >
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
          {error}
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          No agents found. Create your first agent to get started.
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Mode</TableHead>
              <TableHead>Model</TableHead>
              <TableHead>Source</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((agent) => (
              <TableRow
                key={agent.name}
                className="cursor-pointer"
                onClick={() => navigate(`/agents/${encodeURIComponent(agent.name)}`)}
              >
                <TableCell className="font-medium">{agent.name}</TableCell>
                <TableCell className="text-muted-foreground max-w-md truncate">
                  {agent.frontmatter.description}
                </TableCell>
                <TableCell>
                  {agent.frontmatter.mode ? (
                    <Badge
                      variant="outline"
                      className={modeStyles[agent.frontmatter.mode] ?? ""}
                    >
                      {agent.frontmatter.mode}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {agent.frontmatter.model ?? "—"}
                </TableCell>
                <TableCell>
                  <SourceBadge source={agent.source} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <CreateWithAIDialog
        open={aiDialogOpen}
        onOpenChange={setAiDialogOpen}
        entityType="agent"
        existingNames={items.map((a) => a.name)}
        configPath={currentWorkspace?.configPath ?? "~/.config/opencode"}
      />
    </PageLayout>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles without errors**

```bash
cd /path/to/opencode-dashboard/client && npx tsc --noEmit
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add client/src/pages/agents/AgentList.tsx
git commit -m "feat: add Create with AI button to AgentList page"
```

---

## Task 8: Final Build Verification

**Files:** None

- [ ] **Step 1: Run full client build**

```bash
npm run build --prefix client
```

Expected: build succeeds with no TypeScript errors and no unused variable warnings (the client tsconfig has `noUnusedLocals` and `noUnusedParameters` enabled).

- [ ] **Step 2: Run dev server and manually test the full flow**

```bash
npm run dev
```

Open `http://localhost:5173` and verify:

1. Navigate to **Skills** page — "Create with AI" button appears next to "New Skill"
2. Click "Create with AI" — dialog opens with skill explainer text and a textarea
3. "Generate Prompt" button is disabled when textarea is empty
4. Type "a TDD workflow skill" — button becomes enabled
5. Click "Generate Prompt" — dialog transitions to generated state; textarea is gone; "Copy to Clipboard" button is shown; "Generate Another" button is in footer
6. Click "Copy to Clipboard" — toast appears: "Prompt copied! Paste it into your OpenCode session."
7. Click "Generate Another" — dialog resets to input state with empty textarea
8. Click X (close) — dialog resets state on next open
9. Repeat steps 1–8 on **Commands** page and **Agents** page
10. With no entities loaded: verify prompt does NOT include "Existing [entities]:" line (test by temporarily clearing the list in browser devtools or using a fresh empty workspace)

- [ ] **Step 3: Verify clipboard fallback (optional)**

In browser devtools console, temporarily override clipboard API:

```javascript
Object.defineProperty(navigator, 'clipboard', { value: undefined, writable: true });
```

Then click "Copy to Clipboard" — the `execCommand('copy')` fallback should still work. Toast still shows.

- [ ] **Step 4: Final commit if any cleanup needed**

```bash
git add -A
git commit -m "feat: complete Create with AI prompt builder feature"
```

---

## Manual Verification Checklist

- [ ] Skills page: "Create with AI" button renders with Sparkles icon
- [ ] Commands page: "Create with AI" button renders with Sparkles icon
- [ ] Agents page: "Create with AI" button renders with Sparkles icon
- [ ] Dialog opens on each page with correct entity-specific explainer text
- [ ] "Generate Prompt" disabled until text is entered
- [ ] Generated state shows "Copy to Clipboard" (no prompt text shown)
- [ ] Toast shows on copy: "Prompt copied! Paste it into your OpenCode session."
- [ ] "Generate Another" resets to input state
- [ ] Dialog close resets state
- [ ] Empty existing entities: no "Existing ..." line in prompt
- [ ] Config path from workspace context appears in prompt (or fallback `~/.config/opencode`)
- [ ] `npm run build --prefix client` passes with no errors
