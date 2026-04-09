# OpenCode Dashboard

Web dashboard for managing your OpenCode instance's skills, commands, agents, MCP servers, providers/models, and raw config.

## OpenCode Plugin Installation

Install directly from OpenCode CLI:

```bash
opencode plugin install github:igorvelho/opencode-dashboard#release
```

This installs the pre-built plugin globally. Once installed:
1. A **📊 Dashboard** button appears in your OpenCode session prompt
2. Click it to open the dashboard in your browser (launches automatically at `http://localhost:3001`)
3. The dashboard server runs in the background and closes when you exit OpenCode

**Requirements:** OpenCode `1.3.14` or newer.

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
