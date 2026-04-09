import { Router } from "express";
import { WorkspaceService } from "../services/WorkspaceService";
import { workspaceCreateSchema } from "../../../shared/schemas";
import { AppError } from "../middleware/errorHandler";

const router = Router();
const workspaceService = new WorkspaceService();

router.get("/", async (_req, res, next) => {
  try {
    const workspaces = await workspaceService.list();
    res.json(workspaces);
  } catch (err) {
    next(err);
  }
});

router.get("/discover", async (_req, res, next) => {
  try {
    const discovered = await workspaceService.discover();
    res.json(discovered);
  } catch (err) {
    next(err);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const workspace = await workspaceService.get(req.params.id);
    if (!workspace) {
      throw new AppError("WORKSPACE_NOT_FOUND", "Workspace not found", 404);
    }
    res.json(workspace);
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const parsed = workspaceCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError("VALIDATION_ERROR", parsed.error.message, 400);
    }
    const workspace = await workspaceService.create(parsed.data.name, parsed.data.configPath);
    res.status(201).json(workspace);
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const deleted = await workspaceService.delete(req.params.id);
    if (!deleted) {
      throw new AppError("WORKSPACE_NOT_FOUND", "Workspace not found", 404);
    }
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;
