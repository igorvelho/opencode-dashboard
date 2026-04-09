# Token and Cache Breakdown Feature Design

## Overview
The goal is to display a breakdown of input, output, cache-read, and cache-write tokens on the OpenCode dashboard's metrics page. Currently, the dashboard tracks daily token usage but only splits it by input and output tokens. The underlying SQLite database already stores cache metrics (`$.tokens.cache.read` and `$.tokens.cache.write`) per message.

## Proposed Changes

### 1. Shared Types (`shared/types.ts`)
We will expand the existing metric interfaces to include the cache tokens.
- **`DailyMetric`**: Add `cacheReadTokens: number` and `cacheWriteTokens: number`.
- **`ModelMetric`**: Add `cacheReadTokens: number` and `cacheWriteTokens: number`.

### 2. Server API (`server/src/services/MetricsService.ts`)
The `MetricsService` queries need to be updated to extract cache tokens dynamically when grouping by day and by model.
- **`dailyRows` Query**: Add:
  - `COALESCE(SUM(json_extract(m.data, '$.tokens.cache.read')), 0) as cacheReadTokens`
  - `COALESCE(SUM(json_extract(m.data, '$.tokens.cache.write')), 0) as cacheWriteTokens`
- **`modelRows` Query**: Add the same two `COALESCE` selections.

### 3. Client UI (`client/src/pages/MetricsPage.tsx` and `client/src/components/metrics/DailyTokensChart.tsx`)
- **`MetricsPage.tsx`**: Add two new Summary Cards next to the total input and output cards to display 'Total Cache Read Tokens' and 'Total Cache Write Tokens', using the existing values from the `totalCacheRead` and `totalCacheWrite` summary fields.
- **`DailyTokensChart.tsx`**: Add two new `<Bar />` elements to the `BarChart`. Ensure they use the existing `stackId="tokens"` to stack on top of Input and Output tokens. Assign distinct colors from `CHART_COLORS` to distinguish them clearly.

## Error Handling and Testing
- The server SQLite queries use `COALESCE` to default to `0` if `cache.read` or `cache.write` are `NULL`, ensuring backward compatibility for older message formats that didn't track cache tokens.
- The UI handles zero values gracefully without crashing the chart.

## Open Questions / Scope
- Are there further breakdowns required? (e.g. reasoning tokens). Not at this time.
- Will we attempt to assign specific costs to each token type in the future? Yes, potentially, but for now we are only providing volume breakdowns.
