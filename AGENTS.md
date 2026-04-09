# AGENTS.md

## Project

Web dashboard for managing OpenCode configuration (skills, commands, agents, MCP servers, providers). Three-package monorepo: `client/`, `server/`, `shared/`.

## Setup & Commands

```bash
# Install (three separate node_modules — root, server, client)
npm install && cd server && npm install && cd ../client && npm install && cd ..

# Dev (runs both server:3001 and client:5173 via concurrently)
npm run dev

# Tests (server only — no client tests exist)
npm test                              # vitest run in server/
npm run test:watch --prefix server    # vitest watch

# Build
npm run build   # client: tsc -b && vite build, then server: tsc

# Lint (client only — no server linter configured)
npm run lint --prefix client          # eslint
```

## Architecture

- **`shared/`** — TypeScript types (`types.ts`) and Zod validation schemas (`schemas.ts`). Imported by both client and server via `@shared/*` alias.
- **`server/`** — Express API (CommonJS, ts-node). Routes at `src/routes/`, services at `src/services/`. All resource routes are workspace-scoped: `/api/workspaces/:workspaceId/<resource>`. The `workspaceResolver` middleware resolves workspace ID to a `ConfigProvider` attached to `req.workspace`.
- **`client/`** — React 19 + Vite + Tailwind v4 + shadcn/ui (base-nova style). Path alias `@/*` maps to `src/*`. Vite proxies `/api` to `localhost:3001` in dev.

## Key Patterns

- **ConfigProvider abstraction** — `server/src/services/ConfigProvider.ts` is the interface for all file I/O. `LocalConfigProvider` is the only implementation. Services receive a provider, not raw paths.
- **Workspace isolation** — Server stores workspace metadata in `server/data/workspaces.json` (gitignored). Each workspace points to an OpenCode config directory on disk (default `~/.config/opencode`).
- **Zod version split** — Root and client use Zod v4 (`zod@^4.3.6`). Server uses Zod v3 (`zod@^3.23.8`). Shared schemas import from `zod` and are currently written for Zod v3 API. Do not blindly upgrade without reconciling both.
- **No monorepo tool** — This is not an npm workspace. Each package has its own `node_modules` and lockfile. Run `npm install` in each directory separately.

## Testing

- Tests live in `server/tests/` mirroring `server/src/` structure.
- Tests use temp directories (`os.tmpdir()`) with `LocalConfigProvider` — no mocking of the filesystem.
- Run a single test file: `npx vitest run tests/services/SkillService.test.ts` from `server/`.

## Gotchas

- `server/data/` is gitignored but required at runtime. The server creates `workspaces.json` on first run.
- Client `tsconfig.app.json` enables `noUnusedLocals` and `noUnusedParameters` — the build will fail on unused variables.
- Client uses `verbatimModuleSyntax` — use `import type` for type-only imports.
- Server tsconfig `rootDir` is `..` (repo root) so it can compile `shared/`. The compiled output mirrors this structure in `server/dist/`.
- In production the server serves `client/dist/` as static files with a catch-all for SPA routing.
