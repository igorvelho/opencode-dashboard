import { Router } from "express";
import { SkillService } from "../services/SkillService";
import { AppError } from "../middleware/errorHandler";

const router = Router({ mergeParams: true });

router.get("/", async (req, res, next) => {
  try {
    const service = new SkillService(req.workspace!.provider);
    const skills = await service.list();
    res.json(skills);
  } catch (err) {
    next(err);
  }
});

router.get("/:name", async (req, res, next) => {
  try {
    const service = new SkillService(req.workspace!.provider);
    const skill = await service.get(req.params.name);
    if (!skill) {
      throw new AppError("FILE_NOT_FOUND", `Skill '${req.params.name}' not found`, 404);
    }
    res.json(skill);
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const service = new SkillService(req.workspace!.provider);
    const skill = await service.create(req.body);
    res.status(201).json(skill);
  } catch (err) {
    next(err);
  }
});

router.put("/:name", async (req, res, next) => {
  try {
    const service = new SkillService(req.workspace!.provider);
    const skill = await service.update(req.params.name, req.body);
    res.json(skill);
  } catch (err) {
    next(err);
  }
});

router.delete("/:name", async (req, res, next) => {
  try {
    const service = new SkillService(req.workspace!.provider);
    await service.delete(req.params.name);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;
