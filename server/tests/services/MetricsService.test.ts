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

  db.prepare("INSERT INTO project VALUES (?,?,?,?,?)").run("proj-a", "/home/user/proj-a", null, 0, 0);
  db.prepare("INSERT INTO project VALUES (?,?,?,?,?)").run("proj-b", "/home/user/proj-b", null, 0, 0);
  db.prepare("INSERT INTO project VALUES (?,?,?,?,?)").run("global", "/", null, 0, 0);

  db.prepare("INSERT INTO session VALUES (?,?,?,?,?)").run("ses-1", "proj-a", null, 0, 0);
  db.prepare("INSERT INTO session VALUES (?,?,?,?,?)").run("ses-2", "proj-b", null, 0, 0);

  // Use timestamps relative to now so time-range filters work correctly
  const now = Date.now();
  const apr7 = now - 2 * 24 * 60 * 60 * 1000; // 2 days ago
  const apr8 = now - 1 * 24 * 60 * 60 * 1000; // 1 day ago

  const insertMsg = db.prepare("INSERT INTO message VALUES (?,?,?,?,?)");

  insertMsg.run("msg-1", "ses-1", apr7, apr7, JSON.stringify({
    role: "assistant", cost: 0.01, modelID: "claude-sonnet-4-6", providerID: "anthropic",
    tokens: { input: 1000, output: 100, reasoning: 0, cache: { read: 50, write: 0 } },
    time: { created: apr7, completed: apr7 + 5000 }
  }));

  insertMsg.run("msg-2", "ses-1", apr8, apr8, JSON.stringify({
    role: "assistant", cost: 0.02, modelID: "claude-sonnet-4-6", providerID: "anthropic",
    tokens: { input: 2000, output: 200, reasoning: 0, cache: { read: 0, write: 100 } },
    time: { created: apr8, completed: apr8 + 5000 }
  }));

  insertMsg.run("msg-3", "ses-2", apr8, apr8, JSON.stringify({
    role: "assistant", cost: 0.05, modelID: "gpt-4o", providerID: "openai",
    tokens: { input: 5000, output: 500, reasoning: 0, cache: { read: 0, write: 0 } },
    time: { created: apr8, completed: apr8 + 5000 }
  }));

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

    it("filters proj-b correctly", () => {
      const result = service.getMetrics("proj-b", "7d");
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
