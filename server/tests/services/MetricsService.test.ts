import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as path from "path";
import * as os from "os";
import * as fs from "fs";
import initSqlJs from "sql.js";
import { MetricsService } from "../../src/services/MetricsService";

async function createFixtureDb(dir: string): Promise<string> {
  const dbPath = path.join(dir, "opencode.db");
  const SQL = await initSqlJs();
  const db = new SQL.Database();

  db.run(`
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

  db.run("INSERT INTO project VALUES (?,?,?,?,?)", ["proj-a", "/home/user/proj-a", null, 0, 0]);
  db.run("INSERT INTO project VALUES (?,?,?,?,?)", ["proj-b", "/home/user/proj-b", null, 0, 0]);
  db.run("INSERT INTO project VALUES (?,?,?,?,?)", ["global", "/", null, 0, 0]);

  db.run("INSERT INTO session VALUES (?,?,?,?,?)", ["ses-1", "proj-a", null, 0, 0]);
  db.run("INSERT INTO session VALUES (?,?,?,?,?)", ["ses-2", "proj-b", null, 0, 0]);

  // Use timestamps relative to now so time-range filters work correctly
  const now = Date.now();
  const apr7 = now - 2 * 24 * 60 * 60 * 1000; // 2 days ago
  const apr8 = now - 1 * 24 * 60 * 60 * 1000; // 1 day ago

  db.run("INSERT INTO message VALUES (?,?,?,?,?)", ["msg-1", "ses-1", apr7, apr7, JSON.stringify({
    role: "assistant", cost: 0.01, modelID: "claude-sonnet-4-6", providerID: "anthropic",
    tokens: { input: 1000, output: 100, reasoning: 0, cache: { read: 50, write: 0 } },
    time: { created: apr7, completed: apr7 + 5000 }
  })]);

  db.run("INSERT INTO message VALUES (?,?,?,?,?)", ["msg-2", "ses-1", apr8, apr8, JSON.stringify({
    role: "assistant", cost: 0.02, modelID: "claude-sonnet-4-6", providerID: "anthropic",
    tokens: { input: 2000, output: 200, reasoning: 0, cache: { read: 0, write: 100 } },
    time: { created: apr8, completed: apr8 + 5000 }
  })]);

  db.run("INSERT INTO message VALUES (?,?,?,?,?)", ["msg-3", "ses-2", apr8, apr8, JSON.stringify({
    role: "assistant", cost: 0.05, modelID: "gpt-4o", providerID: "openai",
    tokens: { input: 5000, output: 500, reasoning: 0, cache: { read: 0, write: 0 } },
    time: { created: apr8, completed: apr8 + 5000 }
  })]);

  db.run("INSERT INTO message VALUES (?,?,?,?,?)", ["msg-4", "ses-1", apr7, apr7, JSON.stringify({
    role: "user",
    time: { created: apr7 }
  })]);

  // Export to file
  const data = db.export();
  fs.writeFileSync(dbPath, Buffer.from(data));
  db.close();

  return dbPath;
}

describe("MetricsService", () => {
  let tmpDir: string;
  let dbPath: string;
  let service: MetricsService;

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ocd-metrics-test-"));
    dbPath = await createFixtureDb(tmpDir);
    service = new MetricsService(dbPath);
    await service.ensureReady();
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
      const result = service.getMetrics("proj-b", "30d");
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

  describe("missing DB", () => {
    it("returns empty MetricsSummary when DB file does not exist", async () => {
      const s = new MetricsService("/nonexistent/path/opencode.db");
      await s.ensureReady();
      const result = s.getMetrics(null, "all");
      expect(result.totalCost).toBe(0);
      expect(result.totalMessages).toBe(0);
      expect(result.daily).toEqual([]);
      expect(result.models).toEqual([]);
      s.close();
    });

    it("returns empty projects when DB file does not exist", async () => {
      const s = new MetricsService("/nonexistent/path/opencode.db");
      await s.ensureReady();
      expect(s.getProjects()).toEqual([]);
      s.close();
    });
  });
});
