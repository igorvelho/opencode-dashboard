# OpenCode Dashboard

Web dashboard for managing your OpenCode instance's skills, commands, agents, MCP servers, providers/models, and raw config.

## OpenCode Plugin Installation

Add the plugin to your `opencode.json` config:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["opencode-dashboard-plugin"]
}
```

OpenCode will automatically install it via Bun on next startup.

Once running, the dashboard server starts in the background at `http://localhost:3001`. Open it in your browser to manage your OpenCode configuration.

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

Open http://localhost:3001

## Environment Variables

- `OPENCODE_CONFIG_DIR` — path to OpenCode config directory (default: `~/.config/opencode`)
- `PORT` — API server port (default: 3001)

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
