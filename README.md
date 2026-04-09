# OpenCode Dashboard

Web dashboard for managing your [OpenCode](https://opencode.ai) configuration — skills, commands, agents, MCP servers, providers/models, and more.

![License](https://img.shields.io/badge/license-MIT-blue)

## Installation

Add the plugin to your OpenCode config at `~/.config/opencode/opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["github:igorvelho/opencode-dashboard#release"]
}
```

That's it. Next time you start OpenCode, the dashboard will:

1. Start a local web server on **http://localhost:11337**
2. Automatically open the dashboard in your default browser

If you open a second OpenCode instance while one is already running, the plugin detects the existing dashboard and skips starting a duplicate — no extra browser tabs.

**Requirements:** OpenCode `1.4.0` or newer.

## Features

- **Skills** — Create, edit, and delete custom skills (markdown files with YAML frontmatter)
- **Commands** — Manage slash commands (file-based and JSON-defined)
- **Agents** — Configure custom agents with system prompts, model settings, and permissions
- **MCP Servers** — Add, remove, and toggle MCP server configurations
- **Providers & Models** — Configure AI providers and their model settings
- **Config Editor** — Raw JSONC editor for `opencode.json`
- **Backup & Restore** — Full or redacted backups with automatic secret detection
- **Workspace Management** — Multiple workspace support for different config directories

## Configuration

| Environment Variable   | Description                          | Default               |
|------------------------|--------------------------------------|-----------------------|
| `OPENCODE_CONFIG_DIR`  | Path to OpenCode config directory    | `~/.config/opencode`  |
| `PORT`                 | Dashboard server port                | `11337`               |

## Platform Support

The plugin auto-opens the dashboard in your default browser on:

- **WSL** — uses `cmd.exe` to open in the Windows default browser
- **macOS** — uses `open`
- **Windows** — uses `cmd /c start`
- **Linux** — uses `xdg-open`

---

## Development

If you want to develop or contribute to the dashboard itself:

### Prerequisites

- Node.js 18+
- npm

### Setup

```bash
# Install dependencies (three separate node_modules — root, server, client)
npm install
cd server && npm install
cd ../client && npm install
cd ..
```

### Dev Server

```bash
npm run dev
```

This starts both the API server (port 3001) and the Vite dev server (port 5173) via `concurrently`. Open **http://localhost:5173** — the Vite dev server proxies API requests to the backend.

### Production Build

```bash
npm run build
npm start
```

Open **http://localhost:11337** — the server serves the built client as static files.

### Tests

```bash
npm test                              # run all tests (server)
npm run test:watch --prefix server    # watch mode
```

Tests live in `server/tests/` and use temp directories with real file I/O (no mocks).

### Architecture

```
opencode-dashboard/
├── client/        React 19 + Vite + Tailwind v4 + shadcn/ui
├── server/        Express API (TypeScript)
├── shared/        TypeScript types and Zod validation schemas
└── plugin/        OpenCode plugin (server-side)
```

- **Client** — React 19, TypeScript, Vite, shadcn/ui (base-nova), Tailwind CSS v4, React Router
- **Server** — Express, TypeScript, gray-matter, jsonc-parser, Zod
- **Shared** — TypeScript types and Zod schemas imported by both client and server
- **Plugin** — Server-side OpenCode plugin that starts the dashboard and opens the browser

## License

MIT
