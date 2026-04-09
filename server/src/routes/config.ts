import { Router } from "express";
import { ConfigService } from "../services/ConfigService";
import { AppError } from "../middleware/errorHandler";

const router = Router({ mergeParams: true });

// GET returns { content: "<raw JSONC string>" }
// This wrapping is necessary because the raw content may be JSONC
// (comments, trailing commas) which cannot survive JSON.parse() in the client.
router.get("/", async (req, res, next) => {
  try {
    const service = new ConfigService(req.workspace!.provider);
    const raw = await service.getRaw();
    res.json({ content: raw });
  } catch (err) {
    next(err);
  }
});

// PUT accepts { content: "<raw JSONC string>" }
router.put("/", async (req, res, next) => {
  try {
    const service = new ConfigService(req.workspace!.provider);
    const content = req.body?.content;
    if (typeof content !== "string") {
      throw new AppError("VALIDATION_ERROR", "Request body must include a 'content' string field", 400);
    }
    await service.saveRaw(content);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
