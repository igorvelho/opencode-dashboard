# Dashboard Plugin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the OpenCode dashboard plugin to bundle the client/server and launch it directly from the OpenCode TUI via a background Node process.

**Architecture:** A standalone SolidJS TUI plugin (`plugin/tui.tsx`) loaded by OpenCode. When initialized, the plugin spawns `node server/dist/index.js` as a background process. It provides a TUI button to open the dashboard URL in the user's browser. A GitHub action will bundle and publish this.

**Tech Stack:** Node.js (child_process), SolidJS (@opentui/solid), GitHub Actions, @opencode-ai/plugin

---

### Task 1: Create Plugin Package and Dependencies

**Files:**
- Create: `plugin/package.json`

- [ ] **Step 1: Write the plugin package.json**

```json
{
  "name": "opencode-dashboard-plugin",
  "version": "0.1.0",
  "type": "module",
  "exports": {
    "./tui": {
      "import": "./tui.tsx"
    }
  },
  "engines": {
    "opencode": ">=1.3.14"
  },
  "peerDependencies": {
    "@opencode-ai/plugin": "*",
    "@opentui/core": "*",
    "@opentui/solid": "*",
    "solid-js": "*"
  },
  "dependencies": {
    "open": "^10.0.0"
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add plugin/package.json
git commit -m "feat: create plugin package.json"
```

### Task 2: Implement TUI Plugin Component

**Files:**
- Create: `plugin/tui.tsx`

- [ ] **Step 1: Write the SolidJS TUI plugin**

```tsx
/** @jsxImportSource @opentui/solid */
import type { TuiPlugin, TuiPluginModule } from "@opencode-ai/plugin/tui"
import { spawn, ChildProcess } from "child_process"
import { createSignal, onCleanup } from "solid-js"
import { join } from "path"
import { fileURLToPath } from "url"
import { dirname } from "path"

const __dirname = dirname(fileURLToPath(import.meta.url))
const SERVER_ENTRY = join(__dirname, "../server/dist/index.js")

function DashboardButton(props: { api: Parameters<TuiPlugin>[0]; port: () => number }) {
  const handleClick = () => {
    const url = `http://localhost:${props.port()}`
    import("open").then(({ default: open }) => {
      open(url).catch((err) => console.error("Failed to open browser:", err))
    })
  }

  return (
    <button onClick={handleClick}>
      <text fg={props.api.theme.current.textHighlight}>[ 📊 Dashboard ]</text>
    </button>
  )
}

const tui: TuiPlugin = async (api) => {
  let serverProcess: ChildProcess | null = null
  const [port, setPort] = createSignal(3001) // Default port, we can parse stdout later to dynamically find port if it randomizes

  // Start the background process
  try {
    serverProcess = spawn("node", [SERVER_ENTRY], {
      stdio: "ignore", // Prevent console spam in OpenCode TUI, or capture stdout to find port
      detached: false,
    })
  } catch (err) {
    console.error("Failed to start dashboard server:", err)
  }

  // Register cleanup when OpenCode closes
  api.lifecycle.onDispose(() => {
    if (serverProcess && !serverProcess.killed) {
      serverProcess.kill("SIGTERM")
    }
  })

  // Register the TUI Button in the top right slot
  api.slots.register({
    slots: {
      header_right(_ctx) {
        return <DashboardButton api={api} port={port} />
      },
    },
  })
}

const plugin: TuiPluginModule & { id: string } = {
  id: "opencode-dashboard",
  tui,
}

export default plugin
```

- [ ] **Step 2: Commit**

```bash
git add plugin/tui.tsx
git commit -m "feat: implement OpenCode TUI plugin and background process manager"
```

### Task 3: Setup GitHub Action for Distribution

**Files:**
- Create: `.github/workflows/release-plugin.yml`

- [ ] **Step 1: Write the GitHub Action to bundle the plugin**

```yaml
name: Release Plugin

on:
  push:
    tags:
      - 'v*' # Trigger on version tags

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Install dependencies and Build
        run: |
          npm install
          cd server && npm install && cd ..
          cd client && npm install && cd ..
          npm run build

      - name: Prepare Plugin Package
        run: |
          # Create a dist directory for the final release
          mkdir release-dist
          cp -r server release-dist/
          cp -r client release-dist/
          cp -r shared release-dist/
          cp -r plugin release-dist/
          # Ensure we don't carry over massive node_modules if we package them or we install prod only
          cd release-dist/server && npm ci --production && cd ../..

      - name: Publish to NPM
        # Example step: in reality, you would configure NPM_TOKEN
        run: echo "Publishing plugin package..."
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/release-plugin.yml
git commit -m "ci: add github action for plugin release"
```