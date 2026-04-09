# OpenCode Dashboard Plugin Integration Design

## Overview
This document specifies the integration of the `opencode-dashboard` (a web-based configuration dashboard consisting of an Express backend and a React/Vite frontend) into the `opencode` CLI as an installable plugin. The goal is to allow users to install the plugin via `opencode plugin install`, see a dashboard button in the OpenCode TUI, and launch it locally without needing to manually start or manage the server process.

## Architecture & Repository Structure

To support easy distribution via OpenCode's plugin ecosystem without requiring complex local setups for end-users, we will package the application into a single cohesive unit for the plugin.

1. **Monorepo Additions**:
   - We will add a `plugin` package to the existing monorepo.
   - The plugin entry point will be a `tui.tsx` file (compatible with OpenCode's `@opencode-ai/plugin` system).
2. **Build Process**:
   - A unified build script will compile the `client` (Vite) into `client/dist`.
   - The `server` (Express API) will be compiled into `server/dist`, serving the static files from `client/dist`.
   - The `plugin` code itself might be small enough to run as-is (like `oc-tps` does with its `tui.tsx`), but the root `package.json` needs an `exports` block to expose the `./tui` path for OpenCode.
3. **Distribution**:
   - We will create a new package `plugin` in the monorepo.
   - We will configure a GitHub Action to publish an NPM package (e.g., `opencode-dashboard-plugin`) or push a compiled `dist` branch.
   - This compiled distribution will bundle the built `server/dist`, the `client/dist`, and the `tui.tsx` plugin file along with a minimal `package.json` that exposes `./tui`.
   - OpenCode users will install the pre-built package directly.

## Process Management

Since OpenCode plugins run alongside the OpenCode CLI, the plugin itself will manage the dashboard server background process:

1. **Spawning the Server**:
   - Upon plugin initialization, `tui.tsx` will spawn a `node` child process running the built Express server (`server/dist/index.js`).
   - The server defaults to port 3001 but should automatically discover and bind to a random available port if 3001 is taken.
   - The spawned process uses `detached: false` (or explicitly pipes stdout/stderr) to ensure it stays linked to the parent plugin environment.
2. **Termination**:
   - OpenCode provides lifecycle hooks (e.g., `api.lifecycle.onDispose`).
   - Our plugin will capture the spawned process ID and ensure the child process is forcefully killed when OpenCode is closed, preventing zombie instances of the dashboard server.

## UI Integration

The plugin integrates strictly into OpenCode's Terminal User Interface (TUI):

1. **TUI Slot**:
   - Using `api.slots.register()`, we'll inject a UI component (a button labeled "📊 Dashboard" or similar) into a prominent slot like `session_prompt_right` (or a header slot if available).
2. **Launch Mechanism**:
   - When the user clicks the button or invokes a bound command, the plugin will invoke the system's default browser (using an established package like `open` or Node's `child_process.exec` based on platform: `open`, `xdg-open`, `start`).
   - The URL will be `http://localhost:<dynamic_port>` based on what the background Express server negotiated during startup.

## Testing & Self-Review Considerations

- **Process Zombie Testing**: We must verify the background Express process does not persist after the OpenCode session ends.
- **Dependency Paths**: The distributed `plugin` must bundle or resolve its dependencies gracefully, ensuring `express` and its dependencies are present when a user does `opencode plugin install`.
- **TUI API Consistency**: Make sure the plugin relies on stable properties of `@opencode-ai/plugin`.
