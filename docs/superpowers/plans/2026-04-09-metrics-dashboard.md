# Metrics Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Metrics page to the OpenCode Dashboard that reads token usage, cost, and session statistics from OpenCode's SQLite DB and presents them as an overview dashboard with time range filtering and per-project scoping.

**Architecture:** A `MetricsService` opens the OpenCode SQLite DB read-only using `better-sqlite3` and runs aggregation SQL queries. A new `/api/metrics` Express router exposes two endpoints. A React `MetricsPage` fetches data and renders stat cards plus three Recharts charts (daily cost, daily tokens, model breakdown) with a project selector and range selector.

**Tech Stack:** `better-sqlite3` (server), `recharts` (client), TypeScript, Express, React 19, Tailwind v4, shadcn/ui components.

---

## Task 1: Add shared types for metrics

**Files:**
- Modify: `shared/types.ts`

- [ ] **Step 1: Add metrics types to `shared/types.ts`**

Append to the end of `shared/types.ts`:

```ts
// ── Metrics ──
export type TimeRange = '7d' | '30d' | 'current-month' | 'all'

export interface MetricsProject {
  id: string
  name: string
}

export interface DailyMetric {
  date: string
  cost: number
  inputTokens: number
  outputTokens: number
}

export interface ModelMetric {
  modelId: string
  providerId: string
  cost: number
  inputTokens: number
  outputTokens: number
  messageCount: number
}

export interface DailyModelCost {
  date: string
  modelId: string
  cost: number
}

export interface MetricsSummary {
  totalCost: number
  totalInputTokens: number
  totalOutputTokens: number
  totalCacheRead: number
  totalCacheWrite: number
  totalSessions: number
  totalMessages: number
  daily: DailyMetric[]
  models: ModelMetric[]
  dailyByModel: DailyModelCost[]
}
```

- [ ] **Step 2: Commit**

```bash
git add shared/types.ts
git commit -m "feat(shared): add metrics types"
```

---

## Task 2: Install better-sqlite3 in server

**Files:**
- Modify: `server/package.json` (via npm install)

- [ ] **Step 1: Install better-sqlite3 and its types**

```bash
cd server && npm install better-sqlite3 && npm install --save-dev @types/better-sqlite3
```

- [ ] **Step 2: Verify install**

```bash
cd server && node -e "const D = require('better-sqlite3'); console.log('ok')"
```

Expected output: `ok`

- [ ] **Step 3: Commit**

```bash
git add server/package.json server/package-lock.json
git commit -m "feat(server): add better-sqlite3 dependency"
```

---

## Task 3: Implement MetricsService with tests

**Files:**
- Create: `server/src/services/MetricsService.ts`
- Create: `server/tests/services/MetricsService.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `server/tests/services/MetricsService.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as path from "path";
import * as os from "os";
import * as fs from "fs";
import Database from "better-sqlite3";
import { MetricsService } from "../../src/services/MetricsService";

function createFixtureDb(dir: string): string {
  const dbPath = path.join(dir, "opencode.db");
  const db = new Database(dbPath);

  db.exec(`
    CREATE TABLE project (
      id TEXT PRIMARY KEY,
      worktree TEXT,
      name TEXT,
      time_created INTEGER,
      time_updated INTEGER
    );
    CREATE TABLE session (
      id TEXT PRIMARY KEY,
      project_id TEXT,
      workspace_id TEXT,
      time_created INTEGER,
      time_updated INTEGER
    );
    CREATE TABLE message (
      id TEXT PRIMARY KEY,
      session_id TEXT,
      time_created INTEGER,
      time_updated INTEGER,
      data TEXT
    );
  `);

  // Projects
  db.prepare("INSERT INTO project VALUES (?,?,?,?,?)").run("proj-a", "/home/user/proj-a", null, 0, 0);
  db.prepare("INSERT INTO project VALUES (?,?,?,?,?)").run("proj-b", "/home/user/proj-b", null, 0, 0);
  db.prepare("INSERT INTO project VALUES (?,?,?,?,?)").run("global", "/", null, 0, 0);

  // Sessions
  db.prepare("INSERT INTO session VALUES (?,?,?,?,?)").run("ses-1", "proj-a", null, 0, 0);
  db.prepare("INSERT INTO session VALUES (?,?,?,?,?)").run("ses-2", "proj-b", null, 0, 0);

  // Messages — April 7 2026 = 1744243200000 ms epoch, April 8 = 1744329600000
  const apr7 = 1744243200000;
  const apr8 = 1744329600000;

  const insertMsg = db.prepare("INSERT INTO message VALUES (?,?,?,?,?)");

  // proj-a, ses-1, apr7, claude
  insertMsg.run("msg-1", "ses-1", apr7, apr7, JSON.stringify({
    role: "assistant", cost: 0.01, modelID: "claude-sonnet-4-6", providerID: "anthropic",
    tokens: { input: 1000, output: 100, reasoning: 0, cache: { read: 50, write: 0 } },
    time: { created: apr7, completed: apr7 + 5000 }
  }));

  // proj-a, ses-1, apr8, claude
  insertMsg.run("msg-2", "ses-1", apr8, apr8, JSON.stringify({
    role: "assistant", cost: 0.02, modelID: "claude-sonnet-4-6", providerID: "anthropic",
    tokens: { input: 2000, output: 200, reasoning: 0, cache: { read: 0, write: 100 } },
    time: { created: apr8, completed: apr8 + 5000 }
  }));

  // proj-b, ses-2, apr8, gpt
  insertMsg.run("msg-3", "ses-2", apr8, apr8, JSON.stringify({
    role: "assistant", cost: 0.05, modelID: "gpt-4o", providerID: "openai",
    tokens: { input: 5000, output: 500, reasoning: 0, cache: { read: 0, write: 0 } },
    time: { created: apr8, completed: apr8 + 5000 }
  }));

  // user message — should NOT be counted
  insertMsg.run("msg-4", "ses-1", apr7, apr7, JSON.stringify({
    role: "user",
    time: { created: apr7 }
  }));

  db.close();
  return dbPath;
}

describe("MetricsService", () => {
  let tmpDir: string;
  let dbPath: string;
  let service: MetricsService;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ocd-metrics-test-"));
    dbPath = createFixtureDb(tmpDir);
    service = new MetricsService(dbPath);
  });

  afterEach(() => {
    service.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe("getProjects()", () => {
    it("returns all projects excluding global worktree", () => {
      const projects = service.getProjects();
      expect(projects).toHaveLength(2);
      expect(projects.map(p => p.id)).toContain("proj-a");
      expect(projects.map(p => p.id)).toContain("proj-b");
      expect(projects.map(p => p.id)).not.toContain("global");
    });

    it("returns name as worktree path", () => {
      const projects = service.getProjects();
      const a = projects.find(p => p.id === "proj-a")!;
      expect(a.name).toBe("/home/user/proj-a");
    });
  });

  describe("getMetrics() - global", () => {
    it("sums cost across all projects", () => {
      const result = service.getMetrics(null, "all");
      expect(result.totalCost).toBeCloseTo(0.08);
    });

    it("counts only assistant messages", () => {
      const result = service.getMetrics(null, "all");
      expect(result.totalMessages).toBe(3);
    });

    it("counts distinct sessions", () => {
      const result = service.getMetrics(null, "all");
      expect(result.totalSessions).toBe(2);
    });

    it("sums input and output tokens", () => {
      const result = service.getMetrics(null, "all");
      expect(result.totalInputTokens).toBe(8000);
      expect(result.totalOutputTokens).toBe(800);
    });

    it("sums cache read and write tokens", () => {
      const result = service.getMetrics(null, "all");
      expect(result.totalCacheRead).toBe(50);
      expect(result.totalCacheWrite).toBe(100);
    });
  });

  describe("getMetrics() - project scoped", () => {
    it("filters by project_id", () => {
      const result = service.getMetrics("proj-a", "all");
      expect(result.totalCost).toBeCloseTo(0.03);
      expect(result.totalMessages).toBe(2);
    });

    it("returns zero totals for project with no messages", () => {
      const result = service.getMetrics("proj-b", "7d");
      // proj-b msg is on apr8 which is within 7d from now (test is run in 2026)
      expect(result.totalMessages).toBe(1);
    });
  });

  describe("getMetrics() - daily breakdown", () => {
    it("returns one entry per day with messages", () => {
      const result = service.getMetrics(null, "all");
      expect(result.daily.length).toBeGreaterThanOrEqual(2);
    });

    it("daily entries have date, cost, inputTokens, outputTokens", () => {
      const result = service.getMetrics(null, "all");
      const entry = result.daily[0];
      expect(entry).toHaveProperty("date");
      expect(entry).toHaveProperty("cost");
      expect(entry).toHaveProperty("inputTokens");
      expect(entry).toHaveProperty("outputTokens");
    });
  });

  describe("getMetrics() - model breakdown", () => {
    it("returns one entry per model+provider", () => {
      const result = service.getMetrics(null, "all");
      expect(result.models).toHaveLength(2);
    });

    it("model entry has correct fields", () => {
      const result = service.getMetrics(null, "all");
      const claude = result.models.find(m => m.modelId === "claude-sonnet-4-6")!;
      expect(claude.providerId).toBe("anthropic");
      expect(claude.messageCount).toBe(2);
      expect(claude.cost).toBeCloseTo(0.03);
    });
  });

  describe("getMetrics() - dailyByModel", () => {
    it("returns entries with date and modelId", () => {
      const result = service.getMetrics(null, "all");
      expect(result.dailyByModel.length).toBeGreaterThan(0);
      expect(result.dailyByModel[0]).toHaveProperty("date");
      expect(result.dailyByModel[0]).toHaveProperty("modelId");
      expect(result.dailyByModel[0]).toHaveProperty("cost");
    });
  });

  describe("missing DB", () => {
    it("returns empty MetricsSummary when DB file does not exist", () => {
      const s = new MetricsService("/nonexistent/path/opencode.db");
      const result = s.getMetrics(null, "all");
      expect(result.totalCost).toBe(0);
      expect(result.totalMessages).toBe(0);
      expect(result.daily).toEqual([]);
      expect(result.models).toEqual([]);
      s.close();
    });

    it("returns empty projects when DB file does not exist", () => {
      const s = new MetricsService("/nonexistent/path/opencode.db");
      expect(s.getProjects()).toEqual([]);
      s.close();
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd server && npx vitest run tests/services/MetricsService.test.ts
```

Expected: FAIL — `MetricsService` not found.

- [ ] **Step 3: Implement MetricsService**

Create `server/src/services/MetricsService.ts`:

```ts
import Database from "better-sqlite3";
import * as os from "os";
import * as path from "path";
import * as fs from "fs";
import type { MetricsSummary, MetricsProject, TimeRange } from "../../../shared/types";

const DEFAULT_DB_PATH = path.join(os.homedir(), ".local", "share", "opencode", "opencode.db");

function getTimeRangeSql(range: TimeRange): string {
  switch (range) {
    case "7d":
      return "AND json_extract(m.data, '$.time.created') >= (strftime('%s','now') - 7*86400) * 1000";
    case "30d":
      return "AND json_extract(m.data, '$.time.created') >= (strftime('%s','now') - 30*86400) * 1000";
    case "current-month":
      return "AND json_extract(m.data, '$.time.created') >= strftime('%s', date('now','start of month')) * 1000";
    case "all":
      return "";
  }
}

export class MetricsService {
  private db: Database.Database | null = null;

  constructor(private dbPath: string = process.env.OPENCODE_DB_PATH ?? DEFAULT_DB_PATH) {
    if (fs.existsSync(this.dbPath)) {
      this.db = new Database(this.dbPath, { readonly: true });
    }
  }

  close(): void {
    this.db?.close();
    this.db = null;
  }

  getProjects(): MetricsProject[] {
    if (!this.db) return [];
    const rows = this.db
      .prepare("SELECT id, worktree as name FROM project WHERE worktree != '/' ORDER BY worktree")
      .all() as { id: string; name: string }[];
    return rows;
  }

  getMetrics(projectId: string | null, range: TimeRange): MetricsSummary {
    if (!this.db) {
      return {
        totalCost: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalCacheRead: 0,
        totalCacheWrite: 0,
        totalSessions: 0,
        totalMessages: 0,
        daily: [],
        models: [],
        dailyByModel: [],
      };
    }

    const timeFilter = getTimeRangeSql(range);
    const projectFilter = projectId ? "AND s.project_id = ?" : "";
    const params: string[] = projectId ? [projectId] : [];

    const baseWhere = `
      FROM message m
      JOIN session s ON m.session_id = s.id
      WHERE json_extract(m.data, '$.role') = 'assistant'
        AND json_extract(m.data, '$.cost') IS NOT NULL
        ${timeFilter}
        ${projectFilter}
    `;

    // 1. Summary totals
    const totalsRow = this.db.prepare(`
      SELECT
        COUNT(DISTINCT m.session_id) as totalSessions,
        COUNT(m.id) as totalMessages,
        COALESCE(SUM(json_extract(m.data, '$.cost')), 0) as totalCost,
        COALESCE(SUM(json_extract(m.data, '$.tokens.input')), 0) as totalInputTokens,
        COALESCE(SUM(json_extract(m.data, '$.tokens.output')), 0) as totalOutputTokens,
        COALESCE(SUM(json_extract(m.data, '$.tokens.cache.read')), 0) as totalCacheRead,
        COALESCE(SUM(json_extract(m.data, '$.tokens.cache.write')), 0) as totalCacheWrite
      ${baseWhere}
    `).get(...params) as {
      totalSessions: number;
      totalMessages: number;
      totalCost: number;
      totalInputTokens: number;
      totalOutputTokens: number;
      totalCacheRead: number;
      totalCacheWrite: number;
    };

    // 2. Daily breakdown
    const dailyRows = this.db.prepare(`
      SELECT
        date(json_extract(m.data, '$.time.created') / 1000, 'unixepoch') as date,
        COALESCE(SUM(json_extract(m.data, '$.cost')), 0) as cost,
        COALESCE(SUM(json_extract(m.data, '$.tokens.input')), 0) as inputTokens,
        COALESCE(SUM(json_extract(m.data, '$.tokens.output')), 0) as outputTokens
      ${baseWhere}
      GROUP BY date
      ORDER BY date ASC
    `).all(...params) as { date: string; cost: number; inputTokens: number; outputTokens: number }[];

    // 3. Model breakdown
    const modelRows = this.db.prepare(`
      SELECT
        json_extract(m.data, '$.modelID') as modelId,
        json_extract(m.data, '$.providerID') as providerId,
        COALESCE(SUM(json_extract(m.data, '$.cost')), 0) as cost,
        COALESCE(SUM(json_extract(m.data, '$.tokens.input')), 0) as inputTokens,
        COALESCE(SUM(json_extract(m.data, '$.tokens.output')), 0) as outputTokens,
        COUNT(m.id) as messageCount
      ${baseWhere}
      GROUP BY modelId, providerId
      ORDER BY cost DESC
    `).all(...params) as {
      modelId: string;
      providerId: string;
      cost: number;
      inputTokens: number;
      outputTokens: number;
      messageCount: number;
    }[];

    // 4. Daily cost per model
    const dailyByModelRows = this.db.prepare(`
      SELECT
        date(json_extract(m.data, '$.time.created') / 1000, 'unixepoch') as date,
        json_extract(m.data, '$.modelID') as modelId,
        COALESCE(SUM(json_extract(m.data, '$.cost')), 0) as cost
      ${baseWhere}
      GROUP BY date, modelId
      ORDER BY date ASC, cost DESC
    `).all(...params) as { date: string; modelId: string; cost: number }[];

    return {
      totalCost: totalsRow.totalCost,
      totalInputTokens: totalsRow.totalInputTokens,
      totalOutputTokens: totalsRow.totalOutputTokens,
      totalCacheRead: totalsRow.totalCacheRead,
      totalCacheWrite: totalsRow.totalCacheWrite,
      totalSessions: totalsRow.totalSessions,
      totalMessages: totalsRow.totalMessages,
      daily: dailyRows,
      models: modelRows,
      dailyByModel: dailyByModelRows,
    };
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd server && npx vitest run tests/services/MetricsService.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add server/src/services/MetricsService.ts server/tests/services/MetricsService.test.ts
git commit -m "feat(server): add MetricsService with SQLite aggregation queries"
```

---

## Task 4: Add metrics API routes

**Files:**
- Create: `server/src/routes/metrics.ts`
- Modify: `server/src/index.ts`

- [ ] **Step 1: Create `server/src/routes/metrics.ts`**

```ts
import { Router } from "express";
import { MetricsService } from "../services/MetricsService";
import type { TimeRange } from "../../../shared/types";

const VALID_RANGES: TimeRange[] = ["7d", "30d", "current-month", "all"];

export function createMetricsRouter(service: MetricsService): Router {
  const router = Router();

  router.get("/projects", (_req, res, next) => {
    try {
      const projects = service.getProjects();
      res.json(projects);
    } catch (err) {
      next(err);
    }
  });

  router.get("/", (req, res, next) => {
    try {
      const range = (req.query.range as string) ?? "30d";
      if (!VALID_RANGES.includes(range as TimeRange)) {
        res.status(400).json({ error: { code: "INVALID_RANGE", message: `range must be one of: ${VALID_RANGES.join(", ")}` } });
        return;
      }
      const projectId = (req.query.projectId as string) || null;
      const summary = service.getMetrics(projectId, range as TimeRange);
      res.json(summary);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
```

- [ ] **Step 2: Wire up metrics router in `server/src/index.ts`**

Add these lines to `server/src/index.ts`. Add the import near the other service/route imports:

```ts
import { MetricsService } from "./services/MetricsService";
import { createMetricsRouter } from "./routes/metrics";
```

Add instantiation before the routes block (after the `app.use(express.json(...))` line):

```ts
const metricsService = new MetricsService();
```

Add the route registration with the other `app.use` calls:

```ts
app.use("/api/metrics", createMetricsRouter(metricsService));
```

- [ ] **Step 3: Verify the server starts and endpoints respond**

```bash
cd server && npm run dev &
sleep 3
curl -s http://localhost:3001/api/metrics/projects | head -c 200
curl -s "http://localhost:3001/api/metrics?range=30d" | head -c 200
kill %1
```

Expected: JSON responses (array of projects, and a MetricsSummary object).

- [ ] **Step 4: Commit**

```bash
git add server/src/routes/metrics.ts server/src/index.ts
git commit -m "feat(server): add /api/metrics routes"
```

---

## Task 5: Install recharts in client

**Files:**
- Modify: `client/package.json` (via npm install)

- [ ] **Step 1: Install recharts**

```bash
cd client && npm install recharts
```

- [ ] **Step 2: Verify TypeScript types are available**

```bash
cd client && node -e "require('recharts'); console.log('ok')"
```

Expected: `ok` (recharts bundles its own types)

- [ ] **Step 3: Commit**

```bash
git add client/package.json client/package-lock.json
git commit -m "feat(client): add recharts dependency"
```

---

## Task 6: Add metrics API helpers and hooks to client

**Files:**
- Modify: `client/src/lib/api.ts`
- Create: `client/src/hooks/useMetrics.ts`

- [ ] **Step 1: Add metrics fetch methods to `client/src/lib/api.ts`**

Add the following methods to the `ApiClient` class inside `client/src/lib/api.ts`, before the closing `}`:

```ts
async getMetricsProjects(): Promise<import('@shared/types').MetricsProject[]> {
  const res = await fetch(`${BASE_URL}/metrics/projects`);
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error?.message || res.statusText);
  }
  return res.json();
}

async getMetrics(range: import('@shared/types').TimeRange, projectId: string | null): Promise<import('@shared/types').MetricsSummary> {
  const params = new URLSearchParams({ range });
  if (projectId) params.set("projectId", projectId);
  const res = await fetch(`${BASE_URL}/metrics?${params}`);
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error?.message || res.statusText);
  }
  return res.json();
}
```

- [ ] **Step 2: Create `client/src/hooks/useMetrics.ts`**

```ts
import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import type { MetricsSummary, MetricsProject, TimeRange } from "@shared/types";

export function useMetricsProjects(): {
  projects: MetricsProject[];
  loading: boolean;
  error: string | null;
} {
  const [projects, setProjects] = useState<MetricsProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .getMetricsProjects()
      .then((data) => { if (!cancelled) setProjects(data); })
      .catch((err) => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return { projects, loading, error };
}

export function useMetrics(
  projectId: string | null,
  range: TimeRange
): {
  data: MetricsSummary | null;
  loading: boolean;
  error: string | null;
} {
  const [data, setData] = useState<MetricsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .getMetrics(range, projectId)
      .then((d) => { if (!cancelled) setData(d); })
      .catch((err) => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [projectId, range]);

  return { data, loading, error };
}
```

- [ ] **Step 3: Run the client TypeScript build to check for errors**

```bash
cd client && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add client/src/lib/api.ts client/src/hooks/useMetrics.ts
git commit -m "feat(client): add metrics API helpers and hooks"
```

---

## Task 7: Build MetricsPage and sub-components

**Files:**
- Create: `client/src/pages/MetricsPage.tsx`
- Create: `client/src/components/metrics/StatCards.tsx`
- Create: `client/src/components/metrics/RangeSelector.tsx`
- Create: `client/src/components/metrics/ProjectSelector.tsx`
- Create: `client/src/components/metrics/DailyCostChart.tsx`
- Create: `client/src/components/metrics/DailyTokensChart.tsx`
- Create: `client/src/components/metrics/ModelBreakdownChart.tsx`

- [ ] **Step 1: Create `client/src/components/metrics/RangeSelector.tsx`**

```tsx
import type { TimeRange } from "@shared/types";

const RANGES: { value: TimeRange; label: string }[] = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "current-month", label: "Current month" },
  { value: "all", label: "All time" },
];

interface Props {
  value: TimeRange;
  onChange: (range: TimeRange) => void;
}

export function RangeSelector({ value, onChange }: Props) {
  return (
    <div className="flex gap-1">
      {RANGES.map((r) => (
        <button
          key={r.value}
          onClick={() => onChange(r.value)}
          className={
            "px-3 py-1.5 rounded-md text-sm font-medium transition-colors " +
            (value === r.value
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-muted/80")
          }
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Create `client/src/components/metrics/ProjectSelector.tsx`**

```tsx
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { MetricsProject } from "@shared/types";

interface Props {
  projects: MetricsProject[];
  value: string | null;
  onChange: (id: string | null) => void;
}

export function ProjectSelector({ projects, value, onChange }: Props) {
  return (
    <Select
      value={value ?? "global"}
      onValueChange={(v) => onChange(v === "global" ? null : v)}
    >
      <SelectTrigger className="w-64">
        <SelectValue placeholder="Select project" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="global">Global (all projects)</SelectItem>
        {projects.map((p) => (
          <SelectItem key={p.id} value={p.id}>
            {p.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
```

- [ ] **Step 3: Create `client/src/components/metrics/StatCards.tsx`**

```tsx
import type { MetricsSummary } from "@shared/types";

function fmt(n: number): string {
  return n.toLocaleString();
}

function fmtCost(n: number): string {
  return "$" + n.toFixed(4);
}

interface CardProps {
  label: string;
  value: string;
}

function Card({ label, value }: CardProps) {
  return (
    <div className="rounded-lg border bg-card p-4 flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-2xl font-semibold tabular-nums">{value}</span>
    </div>
  );
}

interface Props {
  data: MetricsSummary;
}

export function StatCards({ data }: Props) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      <Card label="Total Cost" value={fmtCost(data.totalCost)} />
      <Card label="Input Tokens" value={fmt(data.totalInputTokens)} />
      <Card label="Output Tokens" value={fmt(data.totalOutputTokens)} />
      <Card label="Cache Read" value={fmt(data.totalCacheRead)} />
      <Card label="Sessions" value={fmt(data.totalSessions)} />
      <Card label="Messages" value={fmt(data.totalMessages)} />
    </div>
  );
}
```

- [ ] **Step 4: Create `client/src/components/metrics/DailyCostChart.tsx`**

```tsx
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { DailyMetric } from "@shared/types";

function fmtDate(d: string): string {
  const [, m, day] = d.split("-");
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[parseInt(m) - 1]} ${parseInt(day)}`;
}

interface Props {
  data: DailyMetric[];
}

export function DailyCostChart({ data }: Props) {
  const formatted = data.map((d) => ({ ...d, dateLabel: fmtDate(d.date) }));

  return (
    <div className="rounded-lg border bg-card p-4">
      <h3 className="text-sm font-medium mb-4">Daily Cost</h3>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={formatted} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis dataKey="dateLabel" tick={{ fontSize: 12 }} />
          <YAxis
            tick={{ fontSize: 12 }}
            tickFormatter={(v: number) => `$${v.toFixed(3)}`}
          />
          <Tooltip formatter={(v: number) => [`$${v.toFixed(4)}`, "Cost"]} />
          <Bar dataKey="cost" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 5: Create `client/src/components/metrics/DailyTokensChart.tsx`**

```tsx
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { DailyMetric } from "@shared/types";

function fmtDate(d: string): string {
  const [, m, day] = d.split("-");
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[parseInt(m) - 1]} ${parseInt(day)}`;
}

function fmtTokens(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return String(v);
}

interface Props {
  data: DailyMetric[];
}

export function DailyTokensChart({ data }: Props) {
  const formatted = data.map((d) => ({ ...d, dateLabel: fmtDate(d.date) }));

  return (
    <div className="rounded-lg border bg-card p-4">
      <h3 className="text-sm font-medium mb-4">Daily Token Usage</h3>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={formatted} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis dataKey="dateLabel" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} tickFormatter={fmtTokens} />
          <Tooltip formatter={(v: number) => [v.toLocaleString(), ""]} />
          <Legend />
          <Bar dataKey="inputTokens" name="Input" stackId="tokens" fill="hsl(var(--primary))" />
          <Bar dataKey="outputTokens" name="Output" stackId="tokens" fill="hsl(var(--primary) / 0.5)" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 6: Create `client/src/components/metrics/ModelBreakdownChart.tsx`**

```tsx
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { ModelMetric } from "@shared/types";

interface Props {
  data: ModelMetric[];
}

export function ModelBreakdownChart({ data }: Props) {
  const formatted = data.map((m) => ({
    ...m,
    label: m.modelId,
  }));

  return (
    <div className="rounded-lg border bg-card p-4">
      <h3 className="text-sm font-medium mb-4">Cost by Model</h3>
      <ResponsiveContainer width="100%" height={Math.max(180, formatted.length * 40)}>
        <BarChart
          data={formatted}
          layout="vertical"
          margin={{ top: 4, right: 40, bottom: 4, left: 8 }}
        >
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis
            type="number"
            tick={{ fontSize: 12 }}
            tickFormatter={(v: number) => `$${v.toFixed(3)}`}
          />
          <YAxis type="category" dataKey="label" tick={{ fontSize: 12 }} width={160} />
          <Tooltip
            formatter={(v: number) => [`$${v.toFixed(4)}`, "Cost"]}
            labelFormatter={(label: string) => `Model: ${label}`}
          />
          <Bar dataKey="cost" fill="hsl(var(--primary))" radius={[0, 3, 3, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 7: Create `client/src/pages/MetricsPage.tsx`**

```tsx
import { useState } from "react";
import { BarChart2 } from "lucide-react";
import { PageLayout } from "@/components/layout/PageLayout";
import { Skeleton } from "@/components/ui/skeleton";
import { useMetrics, useMetricsProjects } from "@/hooks/useMetrics";
import { RangeSelector } from "@/components/metrics/RangeSelector";
import { ProjectSelector } from "@/components/metrics/ProjectSelector";
import { StatCards } from "@/components/metrics/StatCards";
import { DailyCostChart } from "@/components/metrics/DailyCostChart";
import { DailyTokensChart } from "@/components/metrics/DailyTokensChart";
import { ModelBreakdownChart } from "@/components/metrics/ModelBreakdownChart";
import type { TimeRange } from "@shared/types";

export function MetricsPage() {
  const [range, setRange] = useState<TimeRange>("current-month");
  const [projectId, setProjectId] = useState<string | null>(null);

  const { projects } = useMetricsProjects();
  const { data, loading, error } = useMetrics(projectId, range);

  return (
    <PageLayout
      title="Metrics"
      description="Token usage, cost, and session statistics from your OpenCode sessions."
      icon={<BarChart2 className="h-5 w-5" />}
    >
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <ProjectSelector projects={projects} value={projectId} onChange={setProjectId} />
        <RangeSelector value={range} onChange={setRange} />
      </div>

      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive mb-4">
          {error}
        </div>
      )}

      {loading && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-lg" />
            ))}
          </div>
          <Skeleton className="h-64 rounded-lg" />
          <Skeleton className="h-64 rounded-lg" />
          <Skeleton className="h-48 rounded-lg" />
        </div>
      )}

      {!loading && !error && data && (
        <div className="space-y-4">
          <StatCards data={data} />
          <DailyCostChart data={data.daily} />
          <DailyTokensChart data={data.daily} />
          <ModelBreakdownChart data={data.models} />
        </div>
      )}

      {!loading && !error && data && data.totalMessages === 0 && (
        <p className="text-sm text-muted-foreground mt-4">
          No data found for the selected project and time range.
        </p>
      )}
    </PageLayout>
  );
}
```

- [ ] **Step 8: Run TypeScript build to check for errors**

```bash
cd client && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add client/src/pages/MetricsPage.tsx client/src/components/metrics/
git commit -m "feat(client): add MetricsPage and chart components"
```

---

## Task 8: Wire up routing and sidebar nav

**Files:**
- Modify: `client/src/App.tsx`
- Modify: `client/src/components/layout/Sidebar.tsx`

- [ ] **Step 1: Add the `/metrics` route to `client/src/App.tsx`**

Add import near the other page imports:

```ts
import { MetricsPage } from "./pages/MetricsPage";
```

Add the route inside the `<Routes>` block, after the `<Route path="/" ...>` line:

```tsx
<Route path="/metrics" element={<MetricsPage />} />
```

- [ ] **Step 2: Add Metrics nav item to `client/src/components/layout/Sidebar.tsx`**

Add `BarChart2` to the lucide-react import:

```ts
import {
  LayoutDashboard,
  Sparkles,
  Terminal,
  Bot,
  Server,
  KeyRound,
  FileCode,
  Archive,
  Settings,
  FolderOpen,
  BarChart2,
} from "lucide-react";
```

Add the metrics item to the `navItems` array, after the Dashboard entry:

```ts
{ label: "Metrics", path: "/metrics", icon: BarChart2 },
```

- [ ] **Step 3: Run TypeScript build**

```bash
cd client && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Run server tests to confirm nothing regressed**

```bash
cd server && npm test
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add client/src/App.tsx client/src/components/layout/Sidebar.tsx
git commit -m "feat(client): wire up Metrics page in routing and sidebar nav"
```

---

## Task 9: Smoke test end-to-end

**Files:** none (verification only)

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```

- [ ] **Step 2: Open the dashboard and verify**

Navigate to `http://localhost:5173/metrics` and verify:
- "Metrics" appears in the sidebar
- Project selector shows available projects
- Range selector shows 4 buttons; "Current month" is selected by default
- Stat cards show non-zero cost and token values
- Daily cost chart renders bars
- Daily tokens chart renders stacked bars
- Model breakdown chart shows a horizontal bar per model

- [ ] **Step 3: Switch to a specific project and verify data changes**

Select a project from the dropdown and confirm stat cards update.

- [ ] **Step 4: Switch time ranges and verify**

Click "All time" — confirm totals increase. Click "Last 7 days" — confirm totals shrink or stay same.

- [ ] **Step 5: Final commit if any cosmetic fixes were needed**

```bash
git add -A && git commit -m "fix(client): metrics page smoke test adjustments" 
```
(Skip if no changes needed.)
