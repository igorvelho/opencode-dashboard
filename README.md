# OpenCode Dashboard

A web dashboard for managing your [OpenCode](https://opencode.ai) configuration — skills, commands, agents, MCP servers, providers, models — and tracking your spending metrics and token usage, all from your browser.

## How it works

OpenCode Dashboard runs as an OpenCode **server plugin**. When you start OpenCode, the plugin automatically:

1. Starts a local web server on port `11337`
2. Opens the dashboard in your default browser

From there you can visually manage everything in your OpenCode config — create skills, add MCP servers, tweak agent prompts, configure providers — without hand-editing JSON files.

If you open a second OpenCode instance while one is already running, the plugin detects the existing dashboard and skips starting a duplicate. No extra browser tabs, no port conflicts.

## Installation

Tell OpenCode:

```text
Fetch and follow instructions from https://github.com/igorvelho/opencode-dashboard/blob/master/.opencode/INSTALL.md
```

That's it. Start OpenCode and the dashboard opens automatically at **http://localhost:11337**.

**Requirements:** OpenCode `1.4.0` or newer.

### Manual Installation

If you prefer, you can manually add the plugin to your OpenCode config at `~/.config/opencode/opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["github:igorvelho/opencode-dashboard#release"]
}
```

### Verify Installation

Start a new OpenCode session. Your default browser should open to the dashboard. You should see the version number (e.g. `v0.2.1`) in the bottom-left corner of the sidebar.

### Updating

OpenCode caches plugins after first install and doesn't automatically check for newer versions. To update to the latest release, clear the plugin cache and restart OpenCode:

```bash
rm -rf ~/.cache/opencode/packages/github:igorvelho*
```

> **Note:** This is a current limitation of OpenCode's plugin system — all GitHub-based plugins require a manual cache clear to update. There is no `/plugin update` command yet.

## Features

- **Metrics & Usage** — Track token usage, API costs, and session statistics with visual charts and breakdowns by project and model
- **Skills** — Create, edit, and delete custom skills with a markdown editor and YAML frontmatter support
- **Commands** — Manage slash commands (file-based and JSON-defined, read-only for built-in commands)
- **Agents** — Configure custom agents with system prompts, model overrides, and tool permissions
- **MCP Servers** — Add, remove, and toggle MCP server configurations with a visual editor
- **Providers & Models** — Configure AI providers and their model settings
- **Config Editor** — Raw JSONC editor for `opencode.json` with syntax highlighting
- **Backup & Restore** — Full or redacted config backups with automatic secret detection
- **Workspace Management** — Switch between multiple OpenCode config directories

## Configuration

| Environment Variable  | Description                       | Default              |
|-----------------------|-----------------------------------|----------------------|
| `OPENCODE_CONFIG_DIR` | Path to OpenCode config directory | `~/.config/opencode` |
| `PORT`                | Dashboard server port             | `11337`              |

## Platform Support

The plugin auto-opens the dashboard in your default browser on all platforms:

| Platform    | Method                                          |
|-------------|-------------------------------------------------|
| **WSL**     | `cmd.exe /c start` (opens in Windows browser)   |
| **macOS**   | `open`                                          |
| **Windows** | `cmd /c start`                                  |
| **Linux**   | `xdg-open`                                      |

---

## Contributing

Contributions are welcome! Fork the repo, create a branch, and submit a PR.

### Prerequisites

- Node.js 18+
- npm

### Setup

```bash
git clone https://github.com/igorvelho/opencode-dashboard.git
cd opencode-dashboard

# Install dependencies (three separate node_modules — root, server, client)
npm install
cd server && npm install
cd ../client && npm install
cd ..
```

### Development

```bash
npm run dev
```

This starts both the API server (port 3001) and the Vite dev server (port 5173) via `concurrently`. Open **http://localhost:5173** — the Vite dev server proxies API requests to the backend.

### Tests

```bash
npm test                              # run all tests (server)
npm run test:watch --prefix server    # watch mode
```

Tests live in `server/tests/` and use temp directories with real file I/O (no filesystem mocks).

### Production Build

```bash
npm run build
npm start
```

Open **http://localhost:11337** — the server serves the built client as static files.

### Architecture

```
opencode-dashboard/
├── client/        React 19 + Vite + Tailwind v4 + shadcn/ui
├── server/        Express API (TypeScript)
├── shared/        TypeScript types and Zod validation schemas
└── plugin/        OpenCode server plugin (starts dashboard, opens browser)
```

| Layer      | Stack                                                        |
|------------|--------------------------------------------------------------|
| **Client** | React 19, TypeScript, Vite, shadcn/ui (base-nova), Tailwind CSS v4, React Router |
| **Server** | Express, TypeScript, gray-matter, jsonc-parser, Zod          |
| **Shared** | TypeScript types and Zod schemas used by both client and server |
| **Plugin** | OpenCode server plugin — manages lifecycle, auto-opens browser |

### How Releases Work

This project uses a **CI-driven release process**. You never need to manually build or deploy.

1. **Make your changes** on a feature branch
2. **Submit a PR** to `master` — only the maintainer can merge
3. **On merge to master**, GitHub Actions automatically:
   - Builds the client (Vite) and server (TypeScript)
   - Strips types from the plugin source
   - Installs production dependencies
   - Deploys the built output to the `release` branch
   - Creates a git tag and GitHub Release (if the version in `package.json` was bumped)

The `release` branch is an **orphan branch** containing only compiled, ready-to-run files — it's what OpenCode downloads when users install the plugin via `github:igorvelho/opencode-dashboard#release`.

**To cut a new version:** bump `version` in the root `package.json`, merge to master, and CI handles the rest. The GitHub Release will include auto-generated changelog notes from the commits since the last tag.

**Note:** Pushes to master that don't bump the version still build and deploy to the release branch — they just skip creating a new tag/release. This allows hotfixes without requiring a version bump.

## License

MIT License — see [LICENSE](LICENSE) for details.
