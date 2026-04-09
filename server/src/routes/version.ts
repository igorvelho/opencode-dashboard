import { Router } from "express";
import path from "path";
import fs from "fs";
import { pipeline } from "stream/promises";
import { createWriteStream } from "fs";
import { execSync } from "child_process";

const router = Router();

// ── Version state ──────────────────────────────────────────
interface VersionInfo {
  current: string;
  latest: string | null;
  updateAvailable: boolean;
}

const GITHUB_REPO = "igorvelho/opencode-dashboard";
const GITHUB_BRANCH = "release";

/** Read the current version from the plugin's own package.json */
function getCurrentVersion(): string {
  // At runtime in production, __dirname is server/dist/server/src
  // Plugin package.json is 4 levels up
  const pluginPkgPath = path.join(__dirname, "../../../../package.json");
  try {
    const pkg = JSON.parse(fs.readFileSync(pluginPkgPath, "utf-8"));
    return pkg.version || "0.0.0";
  } catch {
    return "0.0.0";
  }
}

// Cache GitHub response to avoid hammering the API
let latestVersionCache: { version: string; checkedAt: number } | null = null;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

async function getLatestVersion(): Promise<string | null> {
  if (latestVersionCache && Date.now() - latestVersionCache.checkedAt < CACHE_TTL_MS) {
    return latestVersionCache.version;
  }
  try {
    const res = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`,
      { headers: { Accept: "application/vnd.github.v3+json" } },
    );
    if (!res.ok) return null;
    const data: any = await res.json();
    const version = (data.tag_name as string).replace(/^v/, "");
    latestVersionCache = { version, checkedAt: Date.now() };
    return version;
  } catch {
    return null;
  }
}

function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const na = pa[i] || 0;
    const nb = pb[i] || 0;
    if (na !== nb) return na - nb;
  }
  return 0;
}

// ── GET /api/version ─────────────────────────────────────
router.get("/", async (_req, res) => {
  const current = getCurrentVersion();
  const latest = await getLatestVersion();
  const info: VersionInfo = {
    current,
    latest,
    updateAvailable: latest !== null && compareVersions(latest, current) > 0,
  };
  res.json(info);
});

// ── POST /api/version/update ─────────────────────────────
// Downloads the latest client/dist from the release branch and hot-swaps it.
// Also clears the OpenCode plugin cache so the next restart gets fresh server code.
router.post("/update", async (_req, res) => {
  const current = getCurrentVersion();
  const latest = await getLatestVersion();

  if (!latest || compareVersions(latest, current) <= 0) {
    res.json({ success: false, message: "Already up to date" });
    return;
  }

  try {
    // 1. Download the latest client dist tarball from the release branch
    const pluginRoot = path.join(__dirname, "../../../..");
    const clientDistPath = path.join(pluginRoot, "client/dist");
    const updateTmpDir = path.join(pluginRoot, ".update-tmp");

    // Clean up any previous failed update
    if (fs.existsSync(updateTmpDir)) {
      fs.rmSync(updateTmpDir, { recursive: true, force: true });
    }
    fs.mkdirSync(updateTmpDir, { recursive: true });

    // Download the release branch as a tarball
    const tarballUrl = `https://api.github.com/repos/${GITHUB_REPO}/tarball/${GITHUB_BRANCH}`;
    const tarballPath = path.join(updateTmpDir, "release.tar.gz");

    const tarRes = await fetch(tarballUrl, {
      headers: { Accept: "application/vnd.github.v3+json" },
    });
    if (!tarRes.ok || !tarRes.body) {
      throw new Error(`Failed to download release: ${tarRes.status}`);
    }

    // Write tarball to disk
    const fileStream = createWriteStream(tarballPath);
    // @ts-ignore - node fetch body is a ReadableStream
    await pipeline(tarRes.body, fileStream);

    // Extract tarball
    const extractDir = path.join(updateTmpDir, "extracted");
    fs.mkdirSync(extractDir, { recursive: true });
    execSync(`tar -xzf "${tarballPath}" -C "${extractDir}"`, { stdio: "ignore" });

    // Find the extracted directory (GitHub tarballs have a prefix directory)
    const entries = fs.readdirSync(extractDir);
    if (entries.length === 0) throw new Error("Empty tarball");
    const extractedRoot = path.join(extractDir, entries[0]);
    const newClientDist = path.join(extractedRoot, "client/dist");

    if (!fs.existsSync(newClientDist)) {
      throw new Error("client/dist not found in release tarball");
    }

    // 2. Hot-swap client files
    // Remove old client dist and replace with new
    if (fs.existsSync(clientDistPath)) {
      fs.rmSync(clientDistPath, { recursive: true, force: true });
    }
    fs.cpSync(newClientDist, clientDistPath, { recursive: true });

    // 3. Clean up temp files
    fs.rmSync(updateTmpDir, { recursive: true, force: true });

    // 4. Clear the OpenCode plugin cache so next restart gets fresh server code
    const homeDir = process.env.HOME || process.env.USERPROFILE || "";
    const cacheDir = path.join(homeDir, ".cache/opencode/packages/github:igorvelho");
    // Don't delete our own running directory — just mark it stale by removing the lockfile
    // Actually, we should delete it so OpenCode re-downloads on next restart
    // The running process is already loaded in memory, so this is safe on Linux
    if (fs.existsSync(cacheDir)) {
      fs.rmSync(cacheDir, { recursive: true, force: true });
    }

    // 5. Invalidate version cache so next check reflects the update
    latestVersionCache = null;

    res.json({
      success: true,
      message: `Updated client to v${latest}. Server will update on next OpenCode restart.`,
      updatedVersion: latest,
    });
  } catch (err: any) {
    console.error("[version/update] Failed:", err.message);
    res.status(500).json({
      success: false,
      message: `Update failed: ${err.message}`,
    });
  }
});

export default router;
