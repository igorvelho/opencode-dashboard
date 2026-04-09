import { Router } from "express";
import * as path from "path";
import * as fs from "fs/promises";
import { BackupService } from "../services/BackupService";
import { BackupSection, ALL_BACKUP_SECTIONS } from "../../../shared/types";
import { AppError } from "../middleware/errorHandler";

const router = Router({ mergeParams: true });

const VALID_SECTIONS = new Set<string>(ALL_BACKUP_SECTIONS);

function parseSections(raw: unknown): BackupSection[] {
  if (!raw) return ALL_BACKUP_SECTIONS;

  const items = typeof raw === "string" ? raw.split(",") : [];
  const valid = items.filter((s) => VALID_SECTIONS.has(s.trim())) as BackupSection[];
  if (valid.length === 0) {
    throw new AppError(
      "VALIDATION_ERROR",
      `Invalid sections. Valid values: ${ALL_BACKUP_SECTIONS.join(", ")}`,
      400
    );
  }
  return valid;
}

// Create a backup
router.post("/", async (req, res, next) => {
  try {
    const redact = req.query.redact === "true";
    const sections = parseSections(req.query.sections);
    const service = new BackupService(req.workspace!.provider);
    const backup = await service.createBackup(redact, sections);
    res.status(201).json(backup);
  } catch (err) {
    next(err);
  }
});

// List backups
router.get("/", async (req, res, next) => {
  try {
    const service = new BackupService(req.workspace!.provider);
    const backups = await service.listBackups();
    res.json(backups);
  } catch (err) {
    next(err);
  }
});

// Download a backup zip
router.get("/download/:filename", async (req, res, next) => {
  try {
    const { filename } = req.params;

    // Sanitize: only allow alphanumeric, dashes, dots, and must end with .zip
    if (!/^[\w.-]+\.zip$/.test(filename)) {
      throw new AppError("VALIDATION_ERROR", "Invalid filename", 400);
    }

    const basePath = req.workspace!.provider.getBasePath();
    const zipPath = path.join(basePath, "backups", filename);

    try {
      await fs.access(zipPath);
    } catch {
      throw new AppError("NOT_FOUND", "Backup file not found", 404);
    }

    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    const content = await fs.readFile(zipPath);
    res.send(content);
  } catch (err) {
    next(err);
  }
});

// Restore / import from uploaded zip
router.post("/restore", async (req, res, next) => {
  try {
    const service = new BackupService(req.workspace!.provider);

    // Expect raw binary body (zip file)
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", async () => {
      try {
        const zipBuffer = Buffer.concat(chunks);
        if (zipBuffer.length === 0) {
          return next(new AppError("VALIDATION_ERROR", "Empty file uploaded", 400));
        }
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
