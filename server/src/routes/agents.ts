import { Router } from "express";
import { AgentService } from "../services/AgentService";
import { AppError } from "../middleware/errorHandler";

const router = Router({ mergeParams: true });

router.get("/", async (req, res, next) => {
  try {
    const service = new AgentService(req.workspace!.provider);
    const agents = await service.list();
    res.json(agents);
  } catch (err) {
    next(err);
  }
});

router.get("/:name", async (req, res, next) => {
  try {
    const service = new AgentService(req.workspace!.provider);
    const agent = await service.get(req.params.name);
    if (!agent) {
      throw new AppError("FILE_NOT_FOUND", `Agent '${req.params.name}' not found`, 404);
    }
    res.json(agent);
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const service = new AgentService(req.workspace!.provider);
    const agent = await service.create(req.body);
    res.status(201).json(agent);
  } catch (err) {
    next(err);
  }
});

router.put("/:name", async (req, res, next) => {
  try {
    const service = new AgentService(req.workspace!.provider);
    const agent = await service.update(req.params.name, req.body);
    res.json(agent);
  } catch (err) {
    next(err);
  }
});

router.delete("/:name", async (req, res, next) => {
  try {
    const service = new AgentService(req.workspace!.provider);
    await service.delete(req.params.name);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;
