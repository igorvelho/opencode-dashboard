import { Router } from "express";
import { MetricsService } from "../services/MetricsService";
import type { TimeRange } from "../../../shared/types";

const VALID_RANGES: TimeRange[] = ["7d", "30d", "current-month", "all"];

export function createMetricsRouter(service: MetricsService): Router {
  const router = Router();

  router.get("/debug", async (_req, res) => {
    try {
      await service.ensureReady();
      res.json(service.getDebugInfo());
    } catch (err: any) {
      res.status(500).json({ error: err?.message ?? String(err) });
    }
  });

  router.get("/projects", async (_req, res, next) => {
    try {
      await service.ensureReady();
      const projects = service.getProjects();
      res.json(projects);
    } catch (err) {
      next(err);
    }
  });

  router.get("/", async (req, res, next) => {
    try {
      await service.ensureReady();
      const range = (req.query.range as string) ?? "30d";
      if (!VALID_RANGES.includes(range as TimeRange)) {
        res.status(400).json({
          error: {
            code: "INVALID_RANGE",
            message: `range must be one of: ${VALID_RANGES.join(", ")}`,
          },
        });
        return;
      }
      const projectId = (req.query.projectId as string) || null;
      const summary = service.getMetrics(projectId, range as TimeRange);
      const debug = req.query.debug === "1" ? service.getDebugInfo() : undefined;
      res.json(debug ? { ...summary, _debug: debug } : summary);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
