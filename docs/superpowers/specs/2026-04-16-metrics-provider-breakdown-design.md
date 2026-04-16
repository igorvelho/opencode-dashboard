# Metrics Provider Breakdown — Design Spec
_2026-04-16_

## Overview

Add provider-level cost visibility to the Metrics page. Currently the page shows totals, daily cost, token charts, and a flat model breakdown. This feature adds provider stat cards, a stacked daily chart, a clickable day detail panel with ← → navigation, and a tabbed model breakdown grouped by provider.

---

## Data

`providerID` is already present in every assistant message in `opencode.db`. The existing `ModelMetric` type already carries `providerId`. No schema changes needed.

Two new query results are needed:

1. **Provider summary** — per-provider totals (cost, tokens, message count) for the selected range/project. Derived by grouping the existing model query by `providerID`.
2. **Daily cost by provider** — per-day per-provider cost. A new query similar to the existing `dailyByModel` but grouped by `providerID` instead of `modelID`.

### New types (shared/types.ts)

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
  date: string;        // YYYY-MM-DD
  providerId: string;
  cost: number;
}
```

`MetricsSummary` gets two new fields:
```ts
providers: ProviderMetric[];
dailyByProvider: DailyProviderCost[];
```

---

## Backend

### MetricsService — two new queries inside `getMetrics()`

**Provider summary** (derived from existing model query — group by providerId only):
```sql
SELECT
  json_extract(m.data, '$.providerID') as providerId,
  COALESCE(SUM(json_extract(m.data, '$.cost')), 0) as cost,
  COALESCE(SUM(json_extract(m.data, '$.tokens.input')), 0) as inputTokens,
  COALESCE(SUM(json_extract(m.data, '$.tokens.output')), 0) as outputTokens,
  COALESCE(SUM(json_extract(m.data, '$.tokens.cache.read')), 0) as cacheReadTokens,
  COALESCE(SUM(json_extract(m.data, '$.tokens.cache.write')), 0) as cacheWriteTokens,
  COUNT(m.id) as messageCount
[baseWhere]
GROUP BY providerId ORDER BY cost DESC
```

**Daily by provider:**
```sql
SELECT
  date(json_extract(m.data, '$.time.created') / 1000, 'unixepoch') as date,
  json_extract(m.data, '$.providerID') as providerId,
  COALESCE(SUM(json_extract(m.data, '$.cost')), 0) as cost
[baseWhere]
GROUP BY date, providerId ORDER BY date ASC, cost DESC
```

Both use the same `baseWhere` (time range + optional project filter) as existing queries.

---

## Frontend

### Layout changes to MetricsPage

Current order:
1. StatCards
2. DailyCostChart
3. DailyTokensChart
4. ModelBreakdownChart

New order:
1. StatCards
2. **ProviderCards** ← new
3. **DailyCostChart** (updated — stacked by provider, clickable bars)
4. **DayDetailPanel** ← new (visible only when a day is selected)
5. DailyTokensChart
6. **ModelBreakdownChart** (updated — tabbed by provider)

### New components

#### `ProviderCards`
- One card per provider, sorted by cost descending
- Each card: provider name (uppercased), total cost, message count, % of total cost, thin progress bar
- Each provider gets a consistent colour from a fixed palette (index-based, wraps around)
- Zero-cost providers shown with muted styling at the end

#### `DailyCostChart` (updated)
- Bars stacked by provider using the same colour palette as ProviderCards
- Clicking a bar sets `selectedDate` state in MetricsPage (YYYY-MM-DD string or null)
- Selected bar gets a visible highlight (border/glow)
- Weekends shown with slightly dimmed bars

#### `DayDetailPanel`
- Only rendered when `selectedDate` is set
- Header: formatted date + total cost + session count
- Provider/cost share bar (horizontal coloured segments)
- Provider+model breakdown table
- `←` prev day button — navigates to the previous date that has data (skips zero days)
- `→` next day button — navigates to the next date that has data; disabled if today or beyond
- `×` close button to clear `selectedDate`
- Data comes from filtering `data.dailyByProvider` and `data.models` for the selected date

#### `ModelBreakdownChart` (updated)
- Tab row: one tab per provider (sorted by cost)
- Selected tab shows only models for that provider
- Zero-cost providers still get a tab, just show a "no cost data" note
- Default selected tab: highest-cost provider

### Provider colour palette
Fixed array of 8 colours cycling by index (same order = same colour across all components):
```
#6366f1  (indigo)
#f59e0b  (amber)
#10b981  (emerald)
#ef4444  (red)
#3b82f6  (blue)
#8b5cf6  (violet)
#ec4899  (pink)
#14b8a6  (teal)
```
Zero-cost providers always get `#4b5563` (muted grey).

A `useProviderColour(providerId, providers)` hook takes a provider ID and the sorted provider list and returns the consistent hex colour.

---

## State

`MetricsPage` gains one new state variable:
```ts
const [selectedDate, setSelectedDate] = useState<string | null>(null);
```

`selectedDate` is reset to `null` whenever `range` or `projectId` changes.

---

## Out of scope

- No date range picker (custom from/to dates) — existing shortcuts (7d, 30d, current-month, all) are sufficient for now
- No session-level drill-down within a day
- No export of provider breakdown data

---

## Files changed

| File | Change |
|------|--------|
| `shared/types.ts` | Add `ProviderMetric`, `DailyProviderCost`; extend `MetricsSummary` |
| `server/src/services/MetricsService.ts` | Add 2 queries to `getMetrics()` |
| `client/src/pages/MetricsPage.tsx` | Add `selectedDate` state, wire new components |
| `client/src/components/metrics/ProviderCards.tsx` | New |
| `client/src/components/metrics/DailyCostChart.tsx` | Update — stacked + clickable |
| `client/src/components/metrics/DayDetailPanel.tsx` | New |
| `client/src/components/metrics/ModelBreakdownChart.tsx` | Update — tabbed by provider |
| `client/src/hooks/useProviderColour.ts` | New — consistent colour mapping |
