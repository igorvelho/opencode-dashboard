import initSqlJs from "sql.js";
import type { Database } from "sql.js";
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
      // Try loading wasm from multiple possible locations (ncc bundle, tsc output, node_modules)
      const wasmCandidates = [
        path.join(__dirname, "sql-wasm.wasm"),
        path.resolve(__dirname, "../node_modules/sql.js/dist/sql-wasm.wasm"),
        path.resolve(__dirname, "../../../../node_modules/sql.js/dist/sql-wasm.wasm"),
      ];
      console.log("[metrics] __dirname:", __dirname);
      console.log("[metrics] DB path:", this.dbPath);
      console.log("[metrics] DB exists:", fs.existsSync(this.dbPath));
      let wasmBinary: ArrayBuffer | undefined;
      for (const candidate of wasmCandidates) {
        const exists = fs.existsSync(candidate);
        console.log(`[metrics] wasm candidate: ${candidate} — ${exists ? "FOUND" : "not found"}`);
        if (exists && !wasmBinary) {
          const buf = fs.readFileSync(candidate);
          wasmBinary = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
        }
      }
      this.SQL = await initSqlJs(wasmBinary ? { wasmBinary } : undefined);
      console.log("[metrics] sql.js initialized", wasmBinary ? "with wasmBinary" : "without wasmBinary (fallback)");
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

  getMetrics(projectId: string | null, range: TimeRange): MetricsSummary {
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
      };
    }

    try {
      const timeFilter = getTimeRangeSql(range);
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
    } catch (err) {
      console.error("DB Query error:", err);
      throw err;
    }
  }
}
