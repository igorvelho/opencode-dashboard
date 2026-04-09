# OpenCode Dashboard

Web dashboard for managing your OpenCode instance's skills, commands, agents, MCP servers, providers/models, and raw config.

## OpenCode Plugin Installation

**1. Add to `~/.config/opencode/opencode.json`** to start the dashboard server:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["github:igorvelho/opencode-dashboard#release"]
}
```

**2. Add to `~/.config/opencode/tui.json`** to show the link in the TUI prompt bar:

```json
{
  "plugin": ["github:igorvelho/opencode-dashboard#release"]
}
```

OpenCode will automatically install both on next startup.

Once running, the dashboard is at **http://localhost:11337** and a `󰖟 dashboard :11337` label appears in the right side of your prompt bar.

**Requirements:** OpenCode `1.4.0` or newer.

---

## Development Setup

If you want to develop or contribute to the dashboard:

### Quick Start

```bash
npm install
cd server && npm install
cd ../client && npm install
cd ..
npm run dev
```

Open http://localhost:5173

## Production

```bash
npm run build
npm start
```

Open http://localhost:11337

## Environment Variables

- `OPENCODE_CONFIG_DIR` — path to OpenCode config directory (default: `~/.config/opencode`)
- `PORT` — API server port (default: 11337)

## Features

- **Skills** — Create, edit, delete custom skills (markdown files with YAML frontmatter)
- **Commands** — Manage slash commands (file-based and JSON-defined, read-only for JSON)
- **Agents** — Configure custom agents with system prompts, model settings, and permissions
- **MCP Servers** — Add/remove/toggle MCP servers (local and remote)
- **Providers & Models** — Configure AI providers and their model settings
- **Config Editor** — Raw JSONC editor for `opencode.json`
- **Backup & Restore** — Full or redacted backups with automatic secret detection
- **Workspace Management** — Multiple workspace support (different config directories)

## Architecture

- **Client:** React 18, TypeScript, Vite, shadcn/ui, Tailwind CSS, React Router
- **Server:** Express, TypeScript, gray-matter, jsonc-parser, zod
- **Shared:** TypeScript types and Zod validation schemas
