import initSqlJs from "sql.js";
import type { Database } from "sql.js";
import * as os from "os";
import * as path from "path";
import * as fs from "fs";
import type { MetricsSummary, MetricsProject, TimeRange } from "../../../shared/types";
import type { GatewayDailyResult } from "./GatewayService";

const DEFAULT_DB_PATH = path.join(os.homedir(), ".local", "share", "opencode", "opencode.db");

function getTimeRangeSql(range: TimeRange, date?: string): string {
  switch (range) {
    case "day":
      // date is YYYY-MM-DD; filter to that calendar day
      return `AND date(json_extract(m.data, '$.time.created') / 1000, 'unixepoch') = '${date}'`;
    case "30d":
      return "AND json_extract(m.data, '$.time.created') >= (strftime('%s','now') - 30*86400) * 1000";
    case "current-month":
      return "AND json_extract(m.data, '$.time.created') >= strftime('%s', date('now','start of month')) * 1000";
    case "all":
      return "";
  }
}

function rowsToObjects<T>(result: { columns: string[]; values: (number | string | Uint8Array | null)[][] }[]): T[] {
  if (result.length === 0) return [];
  const { columns, values } = result[0];
  return values.map(row => {
    const obj: Record<string, unknown> = {};
    columns.forEach((col, i) => { obj[col] = row[i]; });
    return obj as T;
  });
}

function rowToObject<T>(result: { columns: string[]; values: (number | string | Uint8Array | null)[][] }[]): T | null {
  const rows = rowsToObjects<T>(result);
  return rows.length > 0 ? rows[0] : null;
}

export class MetricsService {
  private db: Database | null = null;
  private SQL: any = null;
  private ready: Promise<void>;
  private lastMtimeMs: number = 0;

  constructor(private dbPath: string = process.env.OPENCODE_DB_PATH ?? DEFAULT_DB_PATH) {
    this.ready = this.init();
  }

  private async init(): Promise<void> {
    try {
      // Try multiple locations for the wasm file
      const candidates = [
        path.join(__dirname, "sql-wasm.wasm"),
      ];
      try {
        const sqlJsDir = path.dirname(require.resolve("sql.js"));
        candidates.push(path.join(sqlJsDir, "sql-wasm.wasm"));
      } catch { /* sql.js bundled, not resolvable */ }

      console.log("[metrics] __dirname:", __dirname);
      console.log("[metrics] DB path:", this.dbPath, "exists:", fs.existsSync(this.dbPath));

      let initOpts: Record<string, unknown> | undefined;
      for (const candidate of candidates) {
        const exists = fs.existsSync(candidate);
        console.log(`[metrics] wasm: ${candidate} — ${exists ? "FOUND" : "not found"}`);
        if (exists) {
          const buf = fs.readFileSync(candidate);
          initOpts = { wasmBinary: buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) };
          break;
        }
      }
      this.SQL = await initSqlJs(initOpts as any);
      console.log("[metrics] sql.js initialized", initOpts ? "with wasmBinary" : "without wasmBinary (fallback)");
      this.reloadDbIfNeeded();
      console.log("[metrics] DB loaded:", this.db ? "yes" : "no");
    } catch (err) {
      console.error("[metrics] Failed to init sql.js:", err);
      this.db = null;
    }
  }

  private reloadDbIfNeeded() {
    if (!fs.existsSync(this.dbPath) || !this.SQL) return;
    try {
      const stats = fs.statSync(this.dbPath);
      if (stats.mtimeMs > this.lastMtimeMs) {
        if (this.db) {
          this.db.close();
        }
        const fileBuffer = fs.readFileSync(this.dbPath);
        this.db = new this.SQL.Database(fileBuffer);
        this.lastMtimeMs = stats.mtimeMs;
      }
    } catch (err) {
      console.error("Error reloading DB:", err);
    }
  }

  async ensureReady(): Promise<void> {
    await this.ready;
    this.reloadDbIfNeeded();
  }

  close(): void {
    this.db?.close();
    this.db = null;
  }

  getDebugInfo(): Record<string, unknown> {
    const candidates = [
      path.join(__dirname, "sql-wasm.wasm"),
    ];
    try {
      const sqlJsDir = path.dirname(require.resolve("sql.js"));
      candidates.push(path.join(sqlJsDir, "sql-wasm.wasm"));
    } catch { /* sql.js bundled */ }
    return {
      __dirname,
      dbPath: this.dbPath,
      dbExists: fs.existsSync(this.dbPath),
      dbLoaded: this.db !== null,
      sqlInitialized: this.SQL !== null,
      wasmCandidates: candidates.map(c => ({ path: c, exists: fs.existsSync(c) })),
    };
  }

  getProjects(): MetricsProject[] {
    this.reloadDbIfNeeded();
    if (!this.db) return [];
    try {
      return rowsToObjects<MetricsProject>(
        this.db.exec("SELECT id, worktree as name FROM project WHERE worktree != '/' ORDER BY worktree")
      );
    } catch {
      return [];
    }
  }

  getMetrics(projectId: string | null, range: TimeRange, date?: string): MetricsSummary {
    this.reloadDbIfNeeded();
    
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
        providers: [],
        dailyByProvider: [],
        costSource: "db",
      };
    }

    try {
      const timeFilter = getTimeRangeSql(range, date);
      const projectFilter = projectId ? "AND s.project_id = ?" : "";
      const params: (string | number | null | Uint8Array)[] = projectId ? [projectId] : [];

      const baseWhere = `
        FROM message m
        JOIN session s ON m.session_id = s.id
        WHERE json_extract(m.data, '$.role') = 'assistant'
          AND json_extract(m.data, '$.cost') IS NOT NULL
          ${timeFilter}
          ${projectFilter}
      `;

      const totalsRow = rowToObject<{
        totalSessions: number;
        totalMessages: number;
        totalCost: number;
        totalInputTokens: number;
        totalOutputTokens: number;
        totalCacheRead: number;
        totalCacheWrite: number;
      }>(this.db.exec(`
        SELECT
          COUNT(DISTINCT m.session_id) as totalSessions,
          COUNT(m.id) as totalMessages,
          COALESCE(SUM(json_extract(m.data, '$.cost')), 0) as totalCost,
          COALESCE(SUM(json_extract(m.data, '$.tokens.input')), 0) as totalInputTokens,
          COALESCE(SUM(json_extract(m.data, '$.tokens.output')), 0) as totalOutputTokens,
          COALESCE(SUM(json_extract(m.data, '$.tokens.cache.read')), 0) as totalCacheRead,
          COALESCE(SUM(json_extract(m.data, '$.tokens.cache.write')), 0) as totalCacheWrite
        ${baseWhere}
      `, params.length > 0 ? params : undefined))!;

      const dailyRows = rowsToObjects<{ date: string; cost: number; inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheWriteTokens: number }>(
        this.db.exec(`
          SELECT
            date(json_extract(m.data, '$.time.created') / 1000, 'unixepoch') as date,
            COALESCE(SUM(json_extract(m.data, '$.cost')), 0) as cost,
            COALESCE(SUM(json_extract(m.data, '$.tokens.input')), 0) as inputTokens,
            COALESCE(SUM(json_extract(m.data, '$.tokens.output')), 0) as outputTokens,
            COALESCE(SUM(json_extract(m.data, '$.tokens.cache.read')), 0) as cacheReadTokens,
            COALESCE(SUM(json_extract(m.data, '$.tokens.cache.write')), 0) as cacheWriteTokens
          ${baseWhere}
          GROUP BY date
          ORDER BY date ASC
        `, params.length > 0 ? params : undefined)
      );

      const modelRows = rowsToObjects<{
        modelId: string;
        providerId: string;
        cost: number;
        inputTokens: number;
        outputTokens: number;
        cacheReadTokens: number;
        cacheWriteTokens: number;
        messageCount: number;
      }>(this.db.exec(`
        SELECT
          json_extract(m.data, '$.modelID') as modelId,
          json_extract(m.data, '$.providerID') as providerId,
          COALESCE(SUM(json_extract(m.data, '$.cost')), 0) as cost,
          COALESCE(SUM(json_extract(m.data, '$.tokens.input')), 0) as inputTokens,
          COALESCE(SUM(json_extract(m.data, '$.tokens.output')), 0) as outputTokens,
          COALESCE(SUM(json_extract(m.data, '$.tokens.cache.read')), 0) as cacheReadTokens,
          COALESCE(SUM(json_extract(m.data, '$.tokens.cache.write')), 0) as cacheWriteTokens,
          COUNT(m.id) as messageCount
        ${baseWhere}
        GROUP BY modelId, providerId
        ORDER BY cost DESC
      `, params.length > 0 ? params : undefined));

      const dailyByModelRows = rowsToObjects<{ date: string; modelId: string; cost: number }>(
        this.db.exec(`
          SELECT
            date(json_extract(m.data, '$.time.created') / 1000, 'unixepoch') as date,
            json_extract(m.data, '$.modelID') as modelId,
            COALESCE(SUM(json_extract(m.data, '$.cost')), 0) as cost
          ${baseWhere}
          GROUP BY date, modelId
          ORDER BY date ASC, cost DESC
        `, params.length > 0 ? params : undefined)
      );

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
        costSource: "db",
      };
    } catch (err) {
      console.error("DB Query error:", err);
      throw err;
    }
  }

  getMetricsWithGateway(
    projectId: string | null,
    range: TimeRange,
    date: string | undefined,
    gatewayData: GatewayDailyResult[]
  ): MetricsSummary {
    const base = this.getMetrics(projectId, range, date);
    return MetricsService.mergeGateway(base, range, date, gatewayData);
  }

  getGatewayDateRange(range: TimeRange, date?: string): { startDate: string; endDate: string } {
    return MetricsService.rangeToDateRange(range, date);
  }

  private static emptySummary(): MetricsSummary {
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
      costSource: "db",
    };
  }

  private static rangeToDateRange(range: TimeRange, date?: string): { startDate: string; endDate: string } {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);

    if (range === "day") {
      const start = date ?? fmt(today);
      const next = new Date(start);
      next.setDate(next.getDate() + 1);
      return { startDate: start, endDate: fmt(next) };
    }
    if (range === "30d") {
      const start = new Date(today);
      start.setDate(start.getDate() - 30);
      return { startDate: fmt(start), endDate: fmt(tomorrow) };
    }
    if (range === "current-month") {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      return { startDate: fmt(start), endDate: fmt(tomorrow) };
    }
    return { startDate: "2020-01-01", endDate: fmt(tomorrow) };
  }

  private static mergeGateway(summary: MetricsSummary, range: TimeRange, date: string | undefined, gatewayData: GatewayDailyResult[]): MetricsSummary {
    if (gatewayData.length === 0) {
      return { ...summary, costSource: "db" };
    }

    const rangeDates = new Set<string>();
    const dailyRows: MetricsSummary["daily"] = [];
    const dailyByModel: MetricsSummary["dailyByModel"] = [];
    const dailyByProvider: MetricsSummary["dailyByProvider"] = [];

    let totalCost = 0;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalCacheRead = 0;
    let totalCacheWrite = 0;

    for (const day of gatewayData) {
      rangeDates.add(day.date);
      totalCost += day.metrics.spend ?? 0;
      totalInputTokens += day.metrics.prompt_tokens ?? 0;
      totalOutputTokens += day.metrics.completion_tokens ?? 0;
      totalCacheRead += day.metrics.cache_read_input_tokens ?? 0;
      totalCacheWrite += day.metrics.cache_creation_input_tokens ?? 0;

      dailyRows.push({
        date: day.date,
        cost: day.metrics.spend ?? 0,
        inputTokens: day.metrics.prompt_tokens ?? 0,
        outputTokens: day.metrics.completion_tokens ?? 0,
        cacheReadTokens: day.metrics.cache_read_input_tokens ?? 0,
        cacheWriteTokens: day.metrics.cache_creation_input_tokens ?? 0,
      });

      for (const [modelId, entry] of Object.entries(day.breakdown?.model_groups ?? {})) {
        dailyByModel.push({ date: day.date, modelId, cost: entry.metrics.spend ?? 0 });
      }

      for (const [providerId, entry] of Object.entries(day.breakdown?.providers ?? {})) {
        dailyByProvider.push({ date: day.date, providerId, cost: entry.metrics.spend ?? 0 });
      }
    }

    const modelMap = new Map<string, {
      modelId: string;
      providerId: string;
      cost: number;
      inputTokens: number;
      outputTokens: number;
      cacheReadTokens: number;
      cacheWriteTokens: number;
      messageCount: number;
    }>();
    const providerMap = new Map<string, {
      providerId: string;
      cost: number;
      inputTokens: number;
      outputTokens: number;
      cacheReadTokens: number;
      cacheWriteTokens: number;
      messageCount: number;
    }>();

    for (const day of gatewayData) {
      for (const [modelId, entry] of Object.entries(day.breakdown?.model_groups ?? {})) {
        const existing = modelMap.get(modelId) ?? {
          modelId,
          providerId: "gateway",
          cost: 0,
          inputTokens: 0,
          outputTokens: 0,
          cacheReadTokens: 0,
          cacheWriteTokens: 0,
          messageCount: 0,
        };
        existing.cost += entry.metrics.spend ?? 0;
        existing.inputTokens += entry.metrics.prompt_tokens ?? 0;
        existing.outputTokens += entry.metrics.completion_tokens ?? 0;
        existing.cacheReadTokens += entry.metrics.cache_read_input_tokens ?? 0;
        existing.cacheWriteTokens += entry.metrics.cache_creation_input_tokens ?? 0;
        existing.messageCount += entry.metrics.successful_requests ?? 0;
        modelMap.set(modelId, existing);
      }

      for (const [providerId, entry] of Object.entries(day.breakdown?.providers ?? {})) {
        const existing = providerMap.get(providerId) ?? {
          providerId,
          cost: 0,
          inputTokens: 0,
          outputTokens: 0,
          cacheReadTokens: 0,
          cacheWriteTokens: 0,
          messageCount: 0,
        };
        existing.cost += entry.metrics.spend ?? 0;
        existing.inputTokens += entry.metrics.prompt_tokens ?? 0;
        existing.outputTokens += entry.metrics.completion_tokens ?? 0;
        existing.cacheReadTokens += entry.metrics.cache_read_input_tokens ?? 0;
        existing.cacheWriteTokens += entry.metrics.cache_creation_input_tokens ?? 0;
        existing.messageCount += entry.metrics.successful_requests ?? 0;
        providerMap.set(providerId, existing);
      }
    }

    const merged = {
      ...summary,
      totalCost,
      totalInputTokens,
      totalOutputTokens,
      totalCacheRead,
      totalCacheWrite,
      daily: dailyRows.sort((a, b) => a.date.localeCompare(b.date)),
      models: Array.from(modelMap.values()).sort((a, b) => b.cost - a.cost),
      dailyByModel: dailyByModel.sort((a, b) => {
        const c = a.date.localeCompare(b.date);
        return c !== 0 ? c : b.cost - a.cost;
      }),
      providers: Array.from(providerMap.values()).sort((a, b) => b.cost - a.cost),
      dailyByProvider: dailyByProvider.sort((a, b) => {
        const c = a.date.localeCompare(b.date);
        return c !== 0 ? c : b.cost - a.cost;
      }),
      costSource: "gateway" as const,
    };

    // If specific day selected but gateway has no row for it, preserve DB data.
    if (range === "day" && date && !rangeDates.has(date)) {
      return { ...summary, costSource: "db" };
    }

    return merged;
  }
}
