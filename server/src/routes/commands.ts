import { Router } from "express";
import { CommandService } from "../services/CommandService";
import { AppError } from "../middleware/errorHandler";

const router = Router({ mergeParams: true });

router.get("/", async (req, res, next) => {
  try {
    const service = new CommandService(req.workspace!.provider);
    const commands = await service.list();
    res.json(commands);
  } catch (err) {
    next(err);
  }
});

router.get("/:name", async (req, res, next) => {
  try {
    const service = new CommandService(req.workspace!.provider);
    const command = await service.get(req.params.name);
    if (!command) {
      throw new AppError("FILE_NOT_FOUND", `Command '${req.params.name}' not found`, 404);
    }
    res.json(command);
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const service = new CommandService(req.workspace!.provider);
    const command = await service.create(req.body);
    res.status(201).json(command);
  } catch (err) {
    next(err);
  }
});

router.put("/:name", async (req, res, next) => {
  try {
    const service = new CommandService(req.workspace!.provider);
    const command = await service.update(req.params.name, req.body);
    res.json(command);
  } catch (err) {
    next(err);
  }
});

router.delete("/:name", async (req, res, next) => {
  try {
    const service = new CommandService(req.workspace!.provider);
    await service.delete(req.params.name);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;
