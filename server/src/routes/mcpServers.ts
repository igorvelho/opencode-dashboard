import { Router } from "express";
import { McpServerService } from "../services/McpServerService";
import { AppError } from "../middleware/errorHandler";

const router = Router({ mergeParams: true });

router.get("/", async (req, res, next) => {
  try {
    const service = new McpServerService(req.workspace!.provider);
    const servers = await service.list();
    res.json(servers);
  } catch (err) {
    next(err);
  }
});

router.get("/:name", async (req, res, next) => {
  try {
    const service = new McpServerService(req.workspace!.provider);
    const server = await service.get(req.params.name);
    if (!server) {
      throw new AppError("NOT_FOUND", `MCP server '${req.params.name}' not found`, 404);
    }
    res.json(server);
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const { name, config } = req.body;
    if (!name || !config) {
      throw new AppError("VALIDATION_ERROR", "Name and config are required", 400);
    }
    const service = new McpServerService(req.workspace!.provider);
    const server = await service.create(name, config);
    res.status(201).json(server);
  } catch (err) {
    next(err);
  }
});

router.put("/:name", async (req, res, next) => {
  try {
    const service = new McpServerService(req.workspace!.provider);
    const server = await service.update(req.params.name, req.body);
    res.json(server);
  } catch (err) {
    next(err);
  }
});

router.patch("/:name/toggle", async (req, res, next) => {
  try {
    const service = new McpServerService(req.workspace!.provider);
    const server = await service.toggle(req.params.name);
    res.json(server);
  } catch (err) {
    next(err);
  }
});

router.delete("/:name", async (req, res, next) => {
  try {
    const service = new McpServerService(req.workspace!.provider);
    await service.delete(req.params.name);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;
