#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const lockDir = path.join(process.cwd(), ".next-build.lock");
const lockMetadataPath = path.join(lockDir, "metadata.json");
const nextBin = path.join(process.cwd(), "node_modules", ".bin", "next");
const waitIntervalMs = readPositiveNumber(process.env.NEXT_BUILD_LOCK_WAIT_MS, 1000);
const staleAfterMs = readPositiveNumber(process.env.NEXT_BUILD_LOCK_STALE_MS, 10 * 60 * 1000);
const buildTimeoutMs = readPositiveNumber(process.env.NEXT_BUILD_TIMEOUT_MS, 10 * 60 * 1000);

let lockAcquired = false;

while (!lockAcquired) {
  try {
    fs.mkdirSync(lockDir);
    lockAcquired = true;
    writeLockMetadata();
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
    if (isStaleLock()) {
      console.warn("Removing stale Next build lock...");
      fs.rmSync(lockDir, { force: true, recursive: true });
      continue;
    }
    console.log("Waiting for active Next build to finish...");
    await new Promise((resolve) => setTimeout(resolve, waitIntervalMs));
  }
}

const cleanup = () => {
  if (!lockAcquired) return;
  fs.rmSync(lockDir, { force: true, recursive: true });
  lockAcquired = false;
};

process.on("exit", cleanup);
process.on("SIGINT", () => {
  cleanup();
  process.exit(130);
});
process.on("SIGTERM", () => {
  cleanup();
  process.exit(143);
});

const result = spawnSync(nextBin, ["build"], {
  env: {
    ...process.env,
    NEXT_DIST_DIR: ".next-build",
    NEXT_TELEMETRY_DISABLED: process.env.NEXT_TELEMETRY_DISABLED || "1",
  },
  stdio: "inherit",
  timeout: buildTimeoutMs,
  killSignal: "SIGTERM",
});

cleanup();
if (result.error?.code === "ETIMEDOUT") {
  console.error(`Next build timed out after ${buildTimeoutMs}ms.`);
  process.exit(124);
}

process.exit(result.status ?? 1);

function writeLockMetadata() {
  fs.writeFileSync(
    lockMetadataPath,
    JSON.stringify(
      {
        pid: process.pid,
        started_at: new Date().toISOString(),
        stale_after_ms: staleAfterMs,
      },
      null,
      2,
    ),
  );
}

function isStaleLock() {
  const metadata = readLockMetadata();
  const now = Date.now();
  const startedAt = metadata?.started_at ? Date.parse(metadata.started_at) : Number.NaN;
  const lockAgeMs = Number.isFinite(startedAt) ? now - startedAt : getLockDirectoryAgeMs(now);

  if (lockAgeMs < staleAfterMs) {
    return false;
  }

  if (!metadata?.pid) {
    return true;
  }

  return !isProcessAlive(metadata.pid);
}

function readLockMetadata() {
  try {
    return JSON.parse(fs.readFileSync(lockMetadataPath, "utf8"));
  } catch {
    return null;
  }
}

function getLockDirectoryAgeMs(now) {
  try {
    return now - fs.statSync(lockDir).mtimeMs;
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

function isProcessAlive(pid) {
  try {
    process.kill(Number(pid), 0);
    return true;
  } catch (error) {
    return error.code === "EPERM";
  }
}

function readPositiveNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}
