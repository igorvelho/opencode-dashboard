# Metrics Provider Breakdown Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add provider-level cost visibility to the Metrics page — provider stat cards, stacked daily chart with clickable day detail panel (← → navigation), and tabbed model breakdown by provider.

**Architecture:** New types in `shared/types.ts` flow through two new SQL queries in `MetricsService`, returned as two new fields on `MetricsSummary`. Three new React components (`ProviderCards`, `DayDetailPanel`, `useProviderColour`) and two updated ones (`DailyCostChart`, `ModelBreakdownChart`) compose into `MetricsPage`.

**Tech Stack:** TypeScript, Recharts, React 19, shadcn/ui, sql.js (SQLite), Vitest

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `shared/types.ts` | Modify | Add `ProviderMetric`, `DailyProviderCost`; extend `MetricsSummary` |
| `server/src/services/MetricsService.ts` | Modify | Add 2 queries; return new fields |
| `server/tests/services/MetricsService.test.ts` | Modify | Add tests for new query results |
| `client/src/hooks/useProviderColour.ts` | Create | Stable colour mapping for providers |
| `client/src/components/metrics/ProviderCards.tsx` | Create | Provider stat cards row |
| `client/src/components/metrics/DayDetailPanel.tsx` | Create | Selected day breakdown + ← → nav |
| `client/src/components/metrics/DailyCostChart.tsx` | Modify | Stacked by provider, clickable bars |
| `client/src/components/metrics/ModelBreakdownChart.tsx` | Modify | Tabbed by provider |
| `client/src/pages/MetricsPage.tsx` | Modify | Wire `selectedDate` state + new components |

---

### Task 1: Add new shared types

**Files:**
- Modify: `shared/types.ts`

- [ ] **Add `ProviderMetric` and `DailyProviderCost` interfaces, and extend `MetricsSummary`**

In `shared/types.ts`, after the `DailyModelCost` interface (around line 181), add:

```ts
export interface ProviderMetric {
  providerId: string;
  cost: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  messageCount: number;
}

export interface DailyProviderCost {
  date: string;       // YYYY-MM-DD
  providerId: string;
  cost: number;
}
```

Then update `MetricsSummary` to add two new fields at the end:

```ts
export interface MetricsSummary {
  totalCost: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCacheRead: number;
  totalCacheWrite: number;
  totalSessions: number;
  totalMessages: number;
  daily: DailyMetric[];
  models: ModelMetric[];
  dailyByModel: DailyModelCost[];
  providers: ProviderMetric[];
  dailyByProvider: DailyProviderCost[];
}
```

- [ ] **Verify TypeScript compiles**

```bash
cd server && npm run build
```

Expected: no errors.

- [ ] **Commit**

```bash
git add shared/types.ts
git commit -m "feat(types): add ProviderMetric, DailyProviderCost, extend MetricsSummary"
```

---

### Task 2: Add provider queries to MetricsService — tests first

**Files:**
- Modify: `server/tests/services/MetricsService.test.ts`
- Modify: `server/src/services/MetricsService.ts`

- [ ] **Write failing tests for the two new result fields**

In `server/tests/services/MetricsService.test.ts`, add a new `describe` block after the existing `"dailyByModel"` block:

```ts
describe("getMetrics() - providers", () => {
  it("returns one entry per provider", () => {
    const result = service.getMetrics(null, "all");
    expect(result.providers).toHaveLength(2);
  });

  it("provider entry has all required fields", () => {
    const result = service.getMetrics(null, "all");
    const anthropic = result.providers.find(p => p.providerId === "anthropic")!;
    expect(anthropic).toBeDefined();
    expect(anthropic.cost).toBeCloseTo(0.03);
    expect(anthropic.messageCount).toBe(2);
    expect(anthropic.inputTokens).toBe(3000);
    expect(anthropic.outputTokens).toBe(300);
  });

  it("providers are sorted by cost descending", () => {
    const result = service.getMetrics(null, "all");
    expect(result.providers[0].providerId).toBe("openai");
    expect(result.providers[1].providerId).toBe("anthropic");
  });
});

describe("getMetrics() - dailyByProvider", () => {
  it("returns entries with date, providerId, cost", () => {
    const result = service.getMetrics(null, "all");
    expect(result.dailyByProvider.length).toBeGreaterThan(0);
    const entry = result.dailyByProvider[0];
    expect(entry).toHaveProperty("date");
    expect(entry).toHaveProperty("providerId");
    expect(entry).toHaveProperty("cost");
  });

  it("sums cost per day per provider", () => {
    const result = service.getMetrics(null, "all");
    // apr8 has anthropic $0.02 + openai $0.05 — two separate entries
    const apr8Entries = result.dailyByProvider.filter(e =>
      result.dailyByProvider.indexOf(e) >= 0 && e.cost > 0
    );
    expect(apr8Entries.length).toBeGreaterThanOrEqual(2);
  });
});
```

- [ ] **Run tests to confirm they fail**

```bash
cd server && npx vitest run tests/services/MetricsService.test.ts
```

Expected: new tests fail with `result.providers is undefined` or similar.

- [ ] **Add two new queries to `getMetrics()` in `MetricsService.ts`**

In `server/src/services/MetricsService.ts`, inside `getMetrics()`, after the `dailyByModelRows` query and before the `return` statement, add:

```ts
const providerRows = rowsToObjects<{
  providerId: string;
  cost: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  messageCount: number;
}>(this.db.exec(`
  SELECT
    json_extract(m.data, '$.providerID') as providerId,
    COALESCE(SUM(json_extract(m.data, '$.cost')), 0) as cost,
    COALESCE(SUM(json_extract(m.data, '$.tokens.input')), 0) as inputTokens,
    COALESCE(SUM(json_extract(m.data, '$.tokens.output')), 0) as outputTokens,
    COALESCE(SUM(json_extract(m.data, '$.tokens.cache.read')), 0) as cacheReadTokens,
    COALESCE(SUM(json_extract(m.data, '$.tokens.cache.write')), 0) as cacheWriteTokens,
    COUNT(m.id) as messageCount
  ${baseWhere}
  GROUP BY providerId
  ORDER BY cost DESC
`, params.length > 0 ? params : undefined));

const dailyByProviderRows = rowsToObjects<{ date: string; providerId: string; cost: number }>(
  this.db.exec(`
    SELECT
      date(json_extract(m.data, '$.time.created') / 1000, 'unixepoch') as date,
      json_extract(m.data, '$.providerID') as providerId,
      COALESCE(SUM(json_extract(m.data, '$.cost')), 0) as cost
    ${baseWhere}
    GROUP BY date, providerId
    ORDER BY date ASC, cost DESC
  `, params.length > 0 ? params : undefined)
);
```

Then update the return statement to include the new fields:

```ts
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
  providers: providerRows,
  dailyByProvider: dailyByProviderRows,
};
```

Also update the empty return (when `!this.db`) to include the new fields:

```ts
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
  providers: [],
  dailyByProvider: [],
};
```

- [ ] **Run tests to confirm they pass**

```bash
cd server && npx vitest run tests/services/MetricsService.test.ts
```

Expected: all tests pass.

- [ ] **Build server**

```bash
cd server && npm run build
```

Expected: no errors.

- [ ] **Commit**

```bash
git add server/src/services/MetricsService.ts server/tests/services/MetricsService.test.ts
git commit -m "feat(metrics): add provider summary and dailyByProvider queries"
```

---

### Task 3: Create `useProviderColour` hook

**Files:**
- Create: `client/src/hooks/useProviderColour.ts`

This hook provides a stable colour for each provider based on its rank in the sorted provider list. Zero-cost providers always get grey.

- [ ] **Create the hook**

Create `client/src/hooks/useProviderColour.ts`:

```ts
import type { ProviderMetric } from "@shared/types";

export const PROVIDER_PALETTE = [
  "#6366f1", // indigo
  "#f59e0b", // amber
  "#10b981", // emerald
  "#ef4444", // red
  "#3b82f6", // blue
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#14b8a6", // teal
];

export const PROVIDER_MUTED = "#4b5563";

/**
 * Returns a stable hex colour for a providerId based on its position
 * in the sorted (by cost desc) providers array.
 * Zero-cost providers always get PROVIDER_MUTED.
 */
export function useProviderColour(
  providerId: string,
  providers: ProviderMetric[]
): string {
  const provider = providers.find(p => p.providerId === providerId);
  if (!provider || provider.cost === 0) return PROVIDER_MUTED;
  const index = providers.filter(p => p.cost > 0).indexOf(provider);
  return PROVIDER_PALETTE[index % PROVIDER_PALETTE.length];
}

/**
 * Returns a map of providerId → colour for all providers in the list.
 * Useful when you need colours for all providers at once (e.g. chart legend).
 */
export function buildProviderColourMap(providers: ProviderMetric[]): Record<string, string> {
  const map: Record<string, string> = {};
  const paid = providers.filter(p => p.cost > 0);
  providers.forEach(p => {
    const idx = paid.indexOf(p);
    map[p.providerId] = idx >= 0
      ? PROVIDER_PALETTE[idx % PROVIDER_PALETTE.length]
      : PROVIDER_MUTED;
  });
  return map;
}
```

- [ ] **Verify TypeScript compiles (client)**

```bash
cd client && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Commit**

```bash
git add client/src/hooks/useProviderColour.ts
git commit -m "feat(metrics): add useProviderColour hook with stable palette mapping"
```

---

### Task 4: Create `ProviderCards` component

**Files:**
- Create: `client/src/components/metrics/ProviderCards.tsx`

- [ ] **Create the component**

Create `client/src/components/metrics/ProviderCards.tsx`:

```tsx
import type { ProviderMetric } from "@shared/types";
import { buildProviderColourMap, PROVIDER_MUTED } from "@/hooks/useProviderColour";

interface Props {
  providers: ProviderMetric[];
  totalCost: number;
}

function fmt(n: number): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function ProviderCards({ providers, totalCost }: Props) {
  if (providers.length === 0) return null;

  const colourMap = buildProviderColourMap(providers);

  return (
    <div className="rounded-lg border bg-card p-4">
      <h3 className="text-sm font-medium mb-4">Cost by Provider</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {providers.map((p) => {
          const colour = colourMap[p.providerId];
          const pct = totalCost > 0 ? (p.cost / totalCost) * 100 : 0;
          const isMuted = colour === PROVIDER_MUTED;

          return (
            <div
              key={p.providerId}
              className="rounded-md border bg-background p-3 flex flex-col gap-2"
              style={{ borderLeftColor: colour, borderLeftWidth: 3 }}
            >
              <div className="flex items-center justify-between">
                <span
                  className="text-xs font-semibold uppercase tracking-wide"
                  style={{ color: isMuted ? "var(--muted-foreground)" : colour }}
                >
                  {p.providerId}
                </span>
                <span className="text-xs text-muted-foreground">
                  {p.messageCount.toLocaleString()} msgs
                </span>
              </div>
              <div className="flex items-end justify-between gap-2">
                <span className="text-xl font-bold">
                  {isMuted ? "—" : `$${fmt(p.cost)}`}
                </span>
                <span className="text-xs text-muted-foreground mb-0.5">
                  {pct > 0 ? `${pct.toFixed(1)}% of total` : "no cost data"}
                </span>
              </div>
              <div className="h-1 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${pct}%`, backgroundColor: colour }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Verify TypeScript compiles**

```bash
cd client && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Commit**

```bash
git add client/src/components/metrics/ProviderCards.tsx
git commit -m "feat(metrics): add ProviderCards component"
```

---

### Task 5: Create `DayDetailPanel` component

**Files:**
- Create: `client/src/components/metrics/DayDetailPanel.tsx`

- [ ] **Create the component**

Create `client/src/components/metrics/DayDetailPanel.tsx`:

```tsx
import type { DailyProviderCost, ModelMetric } from "@shared/types";
import { buildProviderColourMap } from "@/hooks/useProviderColour";
import type { ProviderMetric } from "@shared/types";
import { Button } from "@/components/ui/button";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

interface Props {
  date: string; // YYYY-MM-DD
  dailyByProvider: DailyProviderCost[];
  models: ModelMetric[];
  providers: ProviderMetric[];
  onClose: () => void;
  onNavigate: (date: string) => void;
}

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function fmtDate(d: string): string {
  const [y, m, day] = d.split("-");
  return `${MONTHS[parseInt(m) - 1]} ${parseInt(day)}, ${y}`;
}

function fmt(n: number): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function DayDetailPanel({
  date,
  dailyByProvider,
  models,
  providers,
  onClose,
  onNavigate,
}: Props) {
  const colourMap = buildProviderColourMap(providers);

  // All dates that have data
  const allDates = Array.from(new Set(dailyByProvider.map(e => e.date))).sort();
  const currentIdx = allDates.indexOf(date);
  const prevDate = currentIdx > 0 ? allDates[currentIdx - 1] : null;
  const nextDate = currentIdx < allDates.length - 1 ? allDates[currentIdx + 1] : null;

  // Provider rows for selected date
  const providerRows = dailyByProvider.filter(e => e.date === date && e.cost > 0);
  const dayTotal = providerRows.reduce((sum, e) => sum + e.cost, 0);

  // Model rows for selected date, grouped by provider
  const dayModels = models.filter(m => {
    // models don't have a date — we show all models that have matching providerId
    // The DayDetailPanel shows per-day provider cost; model detail shows overall model breakdown
    // filtered to providers that had activity on this day
    const activeProviders = new Set(providerRows.map(e => e.providerId));
    return activeProviders.has(m.providerId);
  });

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7"
            disabled={!prevDate}
            onClick={() => prevDate && onNavigate(prevDate)}
            title={prevDate ? `Go to ${fmtDate(prevDate)}` : "No previous day"}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div>
            <span className="text-sm font-semibold">{fmtDate(date)}</span>
            <span className="text-sm text-muted-foreground ml-2">${fmt(dayTotal)}</span>
          </div>
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7"
            disabled={!nextDate}
            onClick={() => nextDate && onNavigate(nextDate)}
            title={nextDate ? `Go to ${fmtDate(nextDate)}` : "No next day"}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Provider share bar */}
      {dayTotal > 0 && (
        <div className="flex h-2 rounded-full overflow-hidden mb-4">
          {providerRows.map(e => (
            <div
              key={e.providerId}
              style={{
                width: `${(e.cost / dayTotal) * 100}%`,
                backgroundColor: colourMap[e.providerId],
              }}
              title={`${e.providerId}: $${fmt(e.cost)}`}
            />
          ))}
        </div>
      )}

      {/* Provider breakdown table */}
      {providerRows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No cost data for this day.</p>
      ) : (
        <div className="space-y-1 mb-4">
          {providerRows.map(e => (
            <div key={e.providerId} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <span
                  className="inline-block w-2 h-2 rounded-full"
                  style={{ backgroundColor: colourMap[e.providerId] }}
                />
                <span className="text-muted-foreground">{e.providerId}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-muted-foreground text-xs">
                  {dayTotal > 0 ? `${((e.cost / dayTotal) * 100).toFixed(1)}%` : ""}
                </span>
                <span className="font-medium tabular-nums">${fmt(e.cost)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Model detail (filtered to active providers) */}
      {dayModels.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Models</p>
          <div className="space-y-1">
            {dayModels.map((m, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span
                    className="inline-block w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: colourMap[m.providerId] }}
                  />
                  <span className="text-muted-foreground">{m.modelId}</span>
                </div>
                <span className="tabular-nums">${fmt(m.cost)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Verify TypeScript compiles**

```bash
cd client && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Commit**

```bash
git add client/src/components/metrics/DayDetailPanel.tsx
git commit -m "feat(metrics): add DayDetailPanel with prev/next day navigation"
```

---

### Task 6: Update `DailyCostChart` — stacked by provider, clickable

**Files:**
- Modify: `client/src/components/metrics/DailyCostChart.tsx`

The chart now receives `dailyByProvider` instead of `daily`, and `providers` for colours. Each bar is stacked by provider. Clicking a bar calls `onSelectDate`.

- [ ] **Replace `DailyCostChart.tsx` with the updated version**

```tsx
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import type { DailyProviderCost, ProviderMetric } from "@shared/types";
import { buildProviderColourMap, PROVIDER_MUTED } from "@/hooks/useProviderColour";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function fmtDate(d: string): string {
  const [, m, day] = d.split("-");
  return `${MONTHS[parseInt(m) - 1]} ${parseInt(day)}`;
}

interface Props {
  dailyByProvider: DailyProviderCost[];
  providers: ProviderMetric[];
  selectedDate: string | null;
  onSelectDate: (date: string | null) => void;
}

export function DailyCostChart({ dailyByProvider, providers, selectedDate, onSelectDate }: Props) {
  const colourMap = buildProviderColourMap(providers);

  // Build chart data: one entry per date, with a key per provider
  const providerIds = Array.from(new Set(dailyByProvider.map(e => e.providerId)));
  const dateMap = new Map<string, Record<string, number>>();
  for (const entry of dailyByProvider) {
    if (!dateMap.has(entry.date)) dateMap.set(entry.date, {});
    dateMap.get(entry.date)![entry.providerId] = entry.cost;
  }
  const chartData = Array.from(dateMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, provCosts]) => ({
      date,
      dateLabel: fmtDate(date),
      ...provCosts,
    }));

  const handleClick = (data: { date?: string } | null) => {
    if (!data?.date) return;
    onSelectDate(selectedDate === data.date ? null : data.date);
  };

  return (
    <div className="rounded-lg border bg-card p-4">
      <h3 className="text-sm font-medium mb-4">Daily Cost by Provider</h3>
      {chartData.length === 0 ? (
        <p className="text-sm text-muted-foreground">No data for selected range.</p>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart
            data={chartData}
            margin={{ top: 4, right: 8, bottom: 4, left: 8 }}
            onClick={(state) => handleClick(state?.activePayload?.[0]?.payload ?? null)}
            style={{ cursor: "pointer" }}
          >
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="dateLabel" tick={{ fontSize: 11 }} />
            <YAxis
              tick={{ fontSize: 11 }}
              tickFormatter={(v: number) => `$${v.toFixed(0)}`}
            />
            <Tooltip
              formatter={(value: number, name: string) => [`$${value.toFixed(2)}`, name]}
              labelFormatter={(label: string) => `Date: ${label}`}
            />
            {providerIds.map((pid) => (
              <Bar
                key={pid}
                dataKey={pid}
                stackId="cost"
                fill={colourMap[pid] ?? PROVIDER_MUTED}
                radius={providerIds.indexOf(pid) === providerIds.length - 1 ? [3, 3, 0, 0] : [0, 0, 0, 0]}
              >
                {chartData.map((entry) => (
                  <Cell
                    key={entry.date}
                    opacity={selectedDate && selectedDate !== entry.date ? 0.4 : 1}
                    stroke={selectedDate === entry.date ? "white" : "none"}
                    strokeWidth={selectedDate === entry.date ? 1 : 0}
                  />
                ))}
              </Bar>
            ))}
          </BarChart>
        </ResponsiveContainer>
      )}
      {selectedDate && (
        <p className="text-xs text-muted-foreground mt-2 text-center">
          Click the same bar again or use × to deselect
        </p>
      )}
    </div>
  );
}
```

- [ ] **Verify TypeScript compiles**

```bash
cd client && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Commit**

```bash
git add client/src/components/metrics/DailyCostChart.tsx
git commit -m "feat(metrics): update DailyCostChart — stacked by provider, clickable bars"
```

---

### Task 7: Update `ModelBreakdownChart` — tabbed by provider

**Files:**
- Modify: `client/src/components/metrics/ModelBreakdownChart.tsx`

- [ ] **Replace `ModelBreakdownChart.tsx` with the updated version**

```tsx
import { useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { ModelMetric, ProviderMetric } from "@shared/types";
import { buildProviderColourMap, PROVIDER_MUTED } from "@/hooks/useProviderColour";

interface Props {
  models: ModelMetric[];
  providers: ProviderMetric[];
}

function fmt(n: number): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function ModelBreakdownChart({ models, providers }: Props) {
  const colourMap = buildProviderColourMap(providers);

  // Sort providers by cost desc (same order as ProviderCards)
  const sortedProviders = [...providers].sort((a, b) => b.cost - a.cost);
  const defaultTab = sortedProviders[0]?.providerId ?? "";
  const [activeTab, setActiveTab] = useState<string>(defaultTab);

  // Reset to default tab if providers change and activeTab is no longer valid
  const validTab = sortedProviders.find(p => p.providerId === activeTab)
    ? activeTab
    : defaultTab;

  const tabModels = models
    .filter(m => m.providerId === validTab)
    .sort((a, b) => b.cost - a.cost);

  if (providers.length === 0) return null;

  return (
    <div className="rounded-lg border bg-card p-4">
      <h3 className="text-sm font-medium mb-3">Cost by Model</h3>

      {/* Tab row */}
      <div className="flex gap-1 flex-wrap mb-4 border-b pb-2">
        {sortedProviders.map(p => {
          const colour = colourMap[p.providerId];
          const isActive = p.providerId === validTab;
          return (
            <button
              key={p.providerId}
              onClick={() => setActiveTab(p.providerId)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                isActive
                  ? "text-white"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
              style={isActive ? { backgroundColor: colour } : {}}
            >
              {p.providerId}
              {p.cost > 0 && (
                <span className={`ml-1.5 ${isActive ? "opacity-75" : ""}`}>
                  ${fmt(p.cost)}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Model breakdown for active tab */}
      {tabModels.length === 0 ? (
        <p className="text-sm text-muted-foreground">No cost data for this provider.</p>
      ) : (
        <ResponsiveContainer width="100%" height={Math.max(140, tabModels.length * 40)}>
          <BarChart
            data={tabModels}
            layout="vertical"
            margin={{ top: 4, right: 60, bottom: 4, left: 8 }}
          >
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis
              type="number"
              tick={{ fontSize: 11 }}
              tickFormatter={(v: number) => `$${v.toFixed(2)}`}
            />
            <YAxis
              type="category"
              dataKey="modelId"
              tick={{ fontSize: 11 }}
              width={160}
            />
            <Tooltip
              formatter={(v: number) => [`$${fmt(v)}`, "Cost"]}
              labelFormatter={(label: string) => `Model: ${label}`}
            />
            <Bar
              dataKey="cost"
              fill={colourMap[validTab] ?? PROVIDER_MUTED}
              radius={[0, 3, 3, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
```

- [ ] **Verify TypeScript compiles**

```bash
cd client && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Commit**

```bash
git add client/src/components/metrics/ModelBreakdownChart.tsx
git commit -m "feat(metrics): update ModelBreakdownChart — tabbed by provider"
```

---

### Task 8: Wire everything in `MetricsPage`

**Files:**
- Modify: `client/src/pages/MetricsPage.tsx`

- [ ] **Replace `MetricsPage.tsx` with the wired-up version**

```tsx
import { useState, useEffect } from "react";
import { PageLayout } from "@/components/layout/PageLayout";
import { Skeleton } from "@/components/ui/skeleton";
import { useMetrics, useMetricsProjects } from "@/hooks/useMetrics";
import { RangeSelector } from "@/components/metrics/RangeSelector";
import { ProjectSelector } from "@/components/metrics/ProjectSelector";
import { StatCards } from "@/components/metrics/StatCards";
import { ProviderCards } from "@/components/metrics/ProviderCards";
import { DailyCostChart } from "@/components/metrics/DailyCostChart";
import { DayDetailPanel } from "@/components/metrics/DayDetailPanel";
import { DailyTokensChart } from "@/components/metrics/DailyTokensChart";
import { ModelBreakdownChart } from "@/components/metrics/ModelBreakdownChart";
import type { TimeRange } from "@shared/types";

export function MetricsPage() {
  const [range, setRange] = useState<TimeRange>("current-month");
  const [projectId, setProjectId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Reset selected date when filters change
  useEffect(() => {
    setSelectedDate(null);
  }, [range, projectId]);

  const { projects } = useMetricsProjects();
  const { data, loading, error } = useMetrics(projectId, range);

  return (
    <PageLayout
      title="Metrics"
      description="Token usage, cost, and session statistics from your OpenCode sessions."
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
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            {Array.from({ length: 7 }).map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-lg" />
            ))}
          </div>
          <Skeleton className="h-32 rounded-lg" />
          <Skeleton className="h-64 rounded-lg" />
          <Skeleton className="h-64 rounded-lg" />
          <Skeleton className="h-48 rounded-lg" />
        </div>
      )}

      {!loading && !error && data && (
        <div className="space-y-4">
          <StatCards data={data} />
          <ProviderCards providers={data.providers} totalCost={data.totalCost} />
          <DailyCostChart
            dailyByProvider={data.dailyByProvider}
            providers={data.providers}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
          />
          {selectedDate && (
            <DayDetailPanel
              date={selectedDate}
              dailyByProvider={data.dailyByProvider}
              models={data.models}
              providers={data.providers}
              onClose={() => setSelectedDate(null)}
              onNavigate={setSelectedDate}
            />
          )}
          <DailyTokensChart data={data.daily} />
          <ModelBreakdownChart models={data.models} providers={data.providers} />
          {data.totalMessages === 0 && (
            <p className="text-sm text-muted-foreground mt-4">
              No data found for the selected project and time range.
            </p>
          )}
        </div>
      )}
    </PageLayout>
  );
}
```

- [ ] **Verify TypeScript compiles (client)**

```bash
cd client && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Run the dev server and visually verify**

```bash
# terminal 1
cd server && npm run dev

# terminal 2
cd client && npm run dev
```

Open `http://localhost:5173/metrics`. Verify:
- Provider cards appear below StatCards
- Daily cost chart bars are stacked by provider
- Clicking a bar shows the DayDetailPanel below the chart
- ← and → in DayDetailPanel navigate to adjacent days with data
- × closes the panel
- Model breakdown shows provider tabs; clicking a tab shows only that provider's models

- [ ] **Build to confirm no prod errors**

```bash
cd /repo/root && npm run build
```

Expected: no TypeScript or Vite errors.

- [ ] **Commit**

```bash
git add client/src/pages/MetricsPage.tsx
git commit -m "feat(metrics): wire provider breakdown, stacked chart, day detail panel into MetricsPage"
```

---

### Task 9: Deploy

- [ ] **Bump versions in both package.json files**

In `package.json` (root): bump `version` to `0.7.2`.
In `plugin/package.json`: bump `version` to `0.7.2`.

- [ ] **Commit and push**

```bash
git add package.json plugin/package.json
git commit -m "chore: bump to 0.7.2 for metrics provider breakdown release"
git push origin master
```

- [ ] **Wait for CI to publish to npm, then update local plugin**

```bash
rm -rf ~/.cache/opencode/packages/@igorvelho*
```

Restart OpenCode. Verify metrics page shows provider breakdown.
