# LiteLLM Gateway Cost Integration

## Problem

OpenCode's local cost calculation in the DB is inaccurate when using a LiteLLM gateway proxy:

1. **Double-counts cache tokens** — `prompt_tokens` includes `cache_read_input_tokens` and `cache_creation_input_tokens`, but OpenCode charges `prompt_tokens` at full input rate AND adds cache tokens again at their discounted rates.
2. **Missing cache_creation tokens** — `cache_write` is always 0 in the DB for gateway requests, so cache creation costs ($3.75/M for sonnet) are never billed.
3. **Net effect**: DB shows $8.57 for a day where the gateway actually charged $15.05 — a 43% undercount.

The pricing config in `opencode.json` is correct. The formula using it is wrong (upstream OpenCode bug). Rather than waiting for an upstream fix, the dashboard should use the gateway as the authoritative cost source.

## Solution

Auto-detect LiteLLM gateways and fetch cost/token data from the gateway's `/user/daily/acoint, replacing the inaccurate DB cost data.

## Gateway Detection

For each provider in `opencode.json` that has a `baseURL`:

1. Strip `/v1` suffix from the URL
2. Probe `GET <baseURL>/health` with the provider's `apiKey`
3. If the response contains LiteLLM-specific fields (e.g. `litellm_version`), mark as a LiteLLM gateway
4. Cache the detection result server-side (re-detect on config change or manual refresh)

## Data Source: `/user/daily/activity`

**Endpoint:** `GET <gatewayBaseURL>/user/daily/activity?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD`

**Auth:** `Authorization: Bearer <apiKey>`

**Response structure:**

```json
{
  "results": [
    {
      "date": "2026-04-17",
      "metrics": {
        "spend": 15.07,
        "prompt_tokens": 8630148,
        "completion_tokens": 19073,
        "cache_read_input_tokens": 4478408,
        "cache_creation_input_tokens": 1759534,
        "total_tokens": 8649221,
        "successful_requests": 99,
        "failed_requests": 3,
        "api_requests": 102
      },
      "breakdown": {
        "model_groups": {
          "claude-sonnet-4-6": { "metrics": { "spend": 8.97, "..." : "..." } },
          "gemini-3.1-pro-preview": { "metrics": { "..." : "..." } }
        },
        "providers": {
          "vertex_ai": { "metrics": { "..." : "..." } },
          "bedrock": { "metrics": { "..." : "..." } },
          "azure_ai": { "metrics": { "..." : "..." } }
        }
      }
    }
  ]
}
```

Key: `model_groups` uses logical model names (e.g. `claude-sonnet-4-6`) that match the DB's `modelID` field — no name mapping needed.

## Data Flow

When `GET /api/mange=...` is called:

1. `MetricsService` queries the DB as usual (tokens, sessions, messages, costs)
2. If a LiteLLM gateway is detected, `GatewayService` fetches `/user/daily/activity` for the same date range
3. For the gateway provider, **replace** cost and token fields:
   - `totalCost` from `metrics.spend`
   - `totalInputTokens` from `metrics.prompt_tokens`
   - `totalOutputTokens` from `metrics.completion_tokens`
   - `totalCacheRead` from `metrics.cache_read_input_tokens`
   - `totalCacheWrite` from `metrics.cache_creation_input_tokens`
   - `models[]` from `model_groups` breakdown
   - `providers[]` from `providers` breakdown (shows vertex_ai/bedrock/azure split)
   - `daily[]` one entry per day in `results[]`
   - `dailyByModel[]` from per-day `model_groups`
   - `dailyByProvider[]` from per-day `providers`
4. Keep from DB: `totalSessions`, `totalMessages` (gateway doesn't track these)
5. Non-gateway providers (kiro, github-copilot) keep their DB data untouched
6. Response includes `costSource: 'gateway'`

## Type Changes

Add to `MetricsSummary` in `shared/types.ts`:

```typescript
costSource?: 'db' | 'gateway';
```

## New Files

### `server/src/services/GatewayService.ts`

- Constructor takes config path (reads `opencode.json` provider section)
- `detect(): Promise<GatewayInfo | null>` — probes providers, caches result
- `getDailyActivity(startDate, endDate): Promise<GatewayDailyActivity[]>` — fetches from gateway
- Internal types for gateway response shape

## Changes to Existing Files

- `server/src/services/MetricsService.ts` — `getMetrics()` accepts optional gateway data, merges when present
- `server/src/routes/metrics.ts` — uses `GatewayService`, passes gateway data to `MetricsService`
- `server/src/index.ts` — creates `GatewayService` instance alongside `MetricsService`
- `shared/types.ts` — add `costSource` field to `MetricsSummary`
- Client: show indicator when `costSource === 'gateway'`

## What This Does NOT Change

- DB schema or queries for session/message counts
- Workspace model
- Any non-metrics routes or services
- The `opencode.json` config format
