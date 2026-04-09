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

/** Convert sql.js exec result (columns + values[][]) to an array of objects */
function rowsToObjects<T>(result: { columns: string[]; values: (number | string | Uint8Array | null)[][] }[]): T[] {
  if (result.length === 0) return [];
  const { columns, values } = result[0];
  return values.map(row => {
    const obj: Record<string, unknown> = {};
    columns.forEach((col, i) => { obj[col] = row[i]; });
    return obj as T;
  });
}

/** Convert sql.js exec result to a single object (first row), or null */
function rowToObject<T>(result: { columns: string[]; values: (number | string | Uint8Array | null)[][] }[]): T | null {
  const rows = rowsToObjects<T>(result);
  return rows.length > 0 ? rows[0] : null;
}

export class MetricsService {
  private db: Database | null = null;
  private ready: Promise<void>;

  constructor(private dbPath: string = process.env.OPENCODE_DB_PATH ?? DEFAULT_DB_PATH) {
    this.ready = this.init();
  }

  private async init(): Promise<void> {
    if (!fs.existsSync(this.dbPath)) return;
    try {
      const SQL = await initSqlJs();
      const fileBuffer = fs.readFileSync(this.dbPath);
      this.db = new SQL.Database(fileBuffer);
    } catch {
      this.db = null;
    }
  }

  /** Wait for the database to be ready. Call this before using getProjects/getMetrics if needed. */
  async ensureReady(): Promise<void> {
    await this.ready;
  }

  close(): void {
    this.db?.close();
    this.db = null;
  }

  getProjects(): MetricsProject[] {
    if (!this.db) return [];
    return rowsToObjects<MetricsProject>(
      this.db.exec("SELECT id, worktree as name FROM project WHERE worktree != '/' ORDER BY worktree")
    );
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
    const params: (string | number | null | Uint8Array)[] = projectId ? [projectId] : [];

    const baseWhere = `
      FROM message m
      JOIN session s ON m.session_id = s.id
      WHERE json_extract(m.data, '$.role') = 'assistant'
        AND json_extract(m.data, '$.cost') IS NOT NULL
        ${timeFilter}
        ${projectFilter}
    `;

    // 1. Summary totals
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

    // 2. Daily breakdown
    const dailyRows = rowsToObjects<{ date: string; cost: number; inputTokens: number; outputTokens: number }>(
      this.db.exec(`
        SELECT
          date(json_extract(m.data, '$.time.created') / 1000, 'unixepoch') as date,
          COALESCE(SUM(json_extract(m.data, '$.cost')), 0) as cost,
          COALESCE(SUM(json_extract(m.data, '$.tokens.input')), 0) as inputTokens,
          COALESCE(SUM(json_extract(m.data, '$.tokens.output')), 0) as outputTokens
        ${baseWhere}
        GROUP BY date
        ORDER BY date ASC
      `, params.length > 0 ? params : undefined)
    );

    // 3. Model breakdown
    const modelRows = rowsToObjects<{
      modelId: string;
      providerId: string;
      cost: number;
      inputTokens: number;
      outputTokens: number;
      messageCount: number;
    }>(this.db.exec(`
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
    `, params.length > 0 ? params : undefined));

    // 4. Daily cost per model
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
  }
}
