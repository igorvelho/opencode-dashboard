import express from "express";
import cors from "cors";
import path from "path";
import { errorHandler } from "./middleware/errorHandler";

const app = express();
const PORT = process.env.PORT || 3001;

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

// Routes
app.use("/api/workspaces", workspaceRoutes);
app.use("/api/workspaces/:workspaceId/skills", workspaceResolver, skillRoutes);
app.use("/api/workspaces/:workspaceId/commands", workspaceResolver, commandRoutes);

// Error handler (must be last)
app.use(errorHandler);

// In production, serve client static files
if (process.env.NODE_ENV === "production") {
  const clientDist = path.join(__dirname, "../../client/dist");
  app.use(express.static(clientDist));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(clientDist, "index.html"));
  });
}

app.listen(PORT, () => {
  console.log(`OpenCode Dashboard API running on http://localhost:${PORT}`);
});

export default app;
