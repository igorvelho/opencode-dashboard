import { Router } from "express";
import { ConfigService } from "../services/ConfigService";

const router = Router({ mergeParams: true });

router.get("/", async (req, res, next) => {
  try {
    const service = new ConfigService(req.workspace!.provider);
    const raw = await service.getRaw();
    res.type("application/json").send(raw);
  } catch (err) {
    next(err);
  }
});

router.put("/", async (req, res, next) => {
  try {
    const service = new ConfigService(req.workspace!.provider);
    // Accept raw JSONC string from the body
    let content: string;
    if (typeof req.body === "string") {
      content = req.body;
    } else {
      content = JSON.stringify(req.body, null, 2);
    }
    await service.saveRaw(content);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
