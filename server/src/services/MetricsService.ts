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
