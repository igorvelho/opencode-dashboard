import { Router } from "express";
import { BackupService } from "../services/BackupService";

const router = Router({ mergeParams: true });

router.post("/", async (req, res, next) => {
  try {
    const redact = req.query.redact === "true";
    const service = new BackupService(req.workspace!.provider);
    const backup = await service.createBackup(redact);
    res.status(201).json(backup);
  } catch (err) {
    next(err);
  }
});

router.get("/", async (req, res, next) => {
  try {
    const service = new BackupService(req.workspace!.provider);
    const backups = await service.listBackups();
    res.json(backups);
  } catch (err) {
    next(err);
  }
});

router.post("/restore", async (req, res, next) => {
  try {
    const service = new BackupService(req.workspace!.provider);

    // Expect raw binary body (zip file)
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", async () => {
      try {
        const zipBuffer = Buffer.concat(chunks);
        await service.restore(zipBuffer);
        res.json({ success: true });
      } catch (err) {
        next(err);
      }
    });
    req.on("error", next);
  } catch (err) {
    next(err);
  }
});

export default router;
