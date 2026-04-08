# Metrics Dashboard — Design Spec

**Date:** 2026-04-09  
**Status:** Approved

---

## Overview

Add a Metrics page to the OpenCode Dashboard that surfaces token usage, cost, and session statistics aggregated from OpenCode's SQLite database. Data is read directly from `~/.local/share/opencode/opencode.db` (read-only). No new data store is introduced.

---

## Data Source

OpenCode persists a `cost` field and a `tokens` object on every assistant message in the `message` table. The `data` JSON column contains:

```json
{
  "role": "assistant",
  "cost": 0.016095,
  "tokens": {
    "total": 5443,
    "input": 5244,
    "output": 199,
    "reasoning": 0,
    "cache": { "read": 0, "write": 0 }
  },
  "modelID": "claude-sonnet-4-6",
  "providerID": "anthropic",
  "time": { "created": 1775565684076, "completed": 1775565842447 }
}
```

Cost is pre-calculated by OpenCode — no price inference required.

Sessions are linked to projects via `session.project_id → project.id`. Projects have a `worktree` path (the directory OpenCode was launched from). The `workspace` table in the OpenCode DB is empty; scoping is done via project.

---

## Scope & Navigation

- A new **Metrics** nav item is added to the sidebar (icon: `BarChart2` from lucide-react).
- The page is not workspace-scoped in the dashboard sense — it reads directly from the OpenCode DB and scopes by **project**.
- Route: `/metrics`

---

## DB Access

- **Library:** `better-sqlite3` (added to `server/package.json`)
- **Mode:** Read-only (`{ readonly: true }`)
- **Path resolution:** `process.env.OPENCODE_DB_PATH ?? path.join(os.homedir(), '.local/share/opencode/opencode.db')`
- **Instantiation:** `MetricsService` opens and holds a single DB connection. If the DB file does not exist, the service returns empty results gracefully (no crash).

---

## Server

### MetricsService (`server/src/services/MetricsService.ts`)

Constructor takes `dbPath: string`. Exposes:

```ts
getProjects(): Project[]
getMetrics(projectId: string | null, range: TimeRange): MetricsSummary
```

Where `TimeRange = '7d' | '30d' | 'current-month' | 'all'`.

**`getProjects()`** — returns all projects from the OpenCode DB (excluding the synthetic `global` project with `worktree = '/'`):
```sql
SELECT id, worktree as name FROM project WHERE worktree != '/' ORDER BY worktree
```

**`getMetrics(projectId, range)`** — runs 4 parameterized queries:

1. **Summary totals** — `COUNT(sessions)`, `COUNT(messages)`, `SUM(cost)`, `SUM(input_tokens)`, `SUM(output_tokens)`, `SUM(cache_read)`, `SUM(cache_write)`
2. **Daily breakdown** — same aggregates grouped by UTC date derived from `time.created` (ms epoch → unixepoch)
3. **Model breakdown** — aggregates grouped by `modelID + providerID`
4. **Daily cost per model** — cost grouped by date + modelID

All queries join `message → session` and filter:
- `json_extract(data, '$.role') = 'assistant'`
- `json_extract(data, '$.cost') IS NOT NULL`
- Optional: `session.project_id = ?` (omitted for global)
- Optional: time range filter on `json_extract(data, '$.time.created')`

**Time range SQL:**

| Range | SQL condition |
|---|---|
| `7d` | `json_extract(data,'$.time.created') >= (strftime('%s','now')-7*86400)*1000` |
| `30d` | `json_extract(data,'$.time.created') >= (strftime('%s','now')-30*86400)*1000` |
| `current-month` | `json_extract(data,'$.time.created') >= strftime('%s', date('now','start of month'))*1000` |
| `all` | _(no filter)_ |

### Routes (`server/src/routes/metrics.ts`)

```
GET /api/metrics/projects
GET /api/metrics?range=7d|30d|current-month|all
GET /api/metrics?range=...&projectId=<id>
```

`projectId` is optional — omitting it returns global (all projects) metrics. The `/projects` endpoint returns the list for the selector dropdown.

`MetricsService` is instantiated once in `server/src/index.ts` at startup (same pattern as other services, e.g. `SkillService`) and passed into `createMetricsRouter(metricsService)`.

---

## Shared Types (`shared/types.ts`)

```ts
export type TimeRange = '7d' | '30d' | 'current-month' | 'all'

export interface MetricsProject {
  id: string
  name: string  // worktree path
}

export interface DailyMetric {
  date: string          // 'YYYY-MM-DD'
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

---

## Client

### Route

Added to `client/src/App.tsx` (or router config): `/metrics` → `<MetricsPage />`

### New files

```
client/src/pages/MetricsPage.tsx          — top-level page layout
client/src/components/metrics/
  StatCards.tsx                           — summary stat cards
  DailyCostChart.tsx                      — bar chart: cost per day
  DailyTokensChart.tsx                    — stacked bar: input + output tokens per day
  ModelBreakdownChart.tsx                 — horizontal bar: cost per model
  ProjectSelector.tsx                     — dropdown: "Global" + per-project options
  RangeSelector.tsx                       — 4 preset buttons
client/src/hooks/useMetrics.ts            — fetch hook
client/src/hooks/useMetricsProjects.ts   — fetch hook for project list
```

### Chart Library

Add `recharts` to `client/package.json`. It is the standard charting library for React + shadcn stacks.

### Page Layout

```
[Sidebar nav: Metrics item]

MetricsPage
├── Header: "Metrics"
├── Controls row: [ProjectSelector] [RangeSelector]
├── StatCards row: Total Cost | Input Tokens | Output Tokens | Cache Tokens | Sessions | Messages
├── DailyCostChart (full width)
├── DailyTokensChart (full width)
└── ModelBreakdownChart (full width or half width)
```

### useMetrics hook

```ts
function useMetrics(projectId: string | null, range: TimeRange): {
  data: MetricsSummary | null
  loading: boolean
  error: string | null
}
```

Fetches `/api/metrics?range=<range>&projectId=<id>` (omits `projectId` param when `null`). Refetches when either argument changes.

### Formatting

- Cost displayed as `$0.0161` (4 decimal places)
- Tokens displayed with thousands separators: `5,244`
- Dates on chart X-axis: `Apr 8` format

---

## Error Handling

- If the OpenCode DB does not exist at the configured path, `MetricsService` returns empty `MetricsSummary` (all zeros, empty arrays) rather than throwing. The client shows a friendly "No data found" state.
- Standard API error shape (`ApiError`) used for unexpected errors.
- Client shows a loading skeleton while fetching, and an error banner on failure.

---

## Testing

- `server/tests/services/MetricsService.test.ts` — creates a temp SQLite DB with known fixture data, verifies aggregation correctness for each time range and project filter combination.
- No client tests (consistent with existing project — no client test infrastructure).

---

## Out of Scope

- Real-time / auto-refresh (not requested)
- Custom date range picker (only 4 presets)
- Per-session drill-down (summary overview only)
- Exporting data to CSV/JSON
- Cost alerts or budget thresholds
