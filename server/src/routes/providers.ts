import { Router } from "express";
import { ProviderService } from "../services/ProviderService";
import { AppError } from "../middleware/errorHandler";

const router = Router({ mergeParams: true });

router.get("/", async (req, res, next) => {
  try {
    const service = new ProviderService(req.workspace!.provider);
    const providers = await service.list();
    res.json(providers);
  } catch (err) {
    next(err);
  }
});

router.get("/:name", async (req, res, next) => {
  try {
    const service = new ProviderService(req.workspace!.provider);
    const provider = await service.get(req.params.name);
    if (!provider) {
      throw new AppError("NOT_FOUND", `Provider '${req.params.name}' not found`, 404);
    }
    res.json(provider);
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
    const service = new ProviderService(req.workspace!.provider);
    const provider = await service.create(name, config);
    res.status(201).json(provider);
  } catch (err) {
    next(err);
  }
});

router.put("/:name", async (req, res, next) => {
  try {
    const service = new ProviderService(req.workspace!.provider);
    const provider = await service.update(req.params.name, req.body);
    res.json(provider);
  } catch (err) {
    next(err);
  }
});

router.delete("/:name", async (req, res, next) => {
  try {
    const service = new ProviderService(req.workspace!.provider);
    await service.delete(req.params.name);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;
