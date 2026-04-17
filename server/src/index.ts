import express from "express";
import cors from "cors";
import path from "path";
import { errorHandler } from "./middleware/errorHandler";

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 11337;

app.use(cors());
app.use(express.json({ limit: "10mb" }));

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

import workspaceRoutes from "./routes/workspaces";
import { workspaceResolver } from "./middleware/workspaceResolver";
import skillRoutes from "./routes/skills";
import commandRoutes from "./routes/commands";
import agentRoutes from "./routes/agents";
import mcpServerRoutes from "./routes/mcpServers";
import providerRoutes from "./routes/providers";
import configRoutes from "./routes/config";
import backupRoutes from "./routes/backup";
import { MetricsService } from "./services/MetricsService";
import { GatewayService } from "./services/GatewayService";
import { createMetricsRouter } from "./routes/metrics";
import versionRoutes from "./routes/version";

const metricsService = new MetricsService();
const gatewayService = new GatewayService();

// Routes
app.use("/api/version", versionRoutes);
app.use("/api/metrics", createMetricsRouter(metricsService, gatewayService));
app.use("/api/workspaces", workspaceRoutes);
app.use("/api/workspaces/:workspaceId/skills", workspaceResolver, skillRoutes);
app.use("/api/workspaces/:workspaceId/commands", workspaceResolver, commandRoutes);
app.use("/api/workspaces/:workspaceId/agents", workspaceResolver, agentRoutes);
app.use("/api/workspaces/:workspaceId/mcp-servers", workspaceResolver, mcpServerRoutes);
app.use("/api/workspaces/:workspaceId/providers", workspaceResolver, providerRoutes);
app.use("/api/workspaces/:workspaceId/config", workspaceResolver, configRoutes);
app.use("/api/workspaces/:workspaceId/backup", workspaceResolver, backupRoutes);

// Error handler (must be last)
app.use(errorHandler);

// In production, serve client static files
if (process.env.NODE_ENV === "production") {
  // __dirname is server/dist/server/src — go up 4 levels to reach package root, then into client/dist
  const clientDist = path.join(__dirname, "../../../../client/dist");
  app.use(express.static(clientDist));
  app.get("*", (_req, res, next) => {
    // Don't serve SPA for API routes
    if (_req.path.startsWith("/api")) return next();
    res.sendFile(path.join(clientDist, "index.html"));
  });
}

const server = app.listen(PORT, () => {
  console.log(`OpenCode Dashboard running at http://localhost:${PORT}`);
});

export default app;
