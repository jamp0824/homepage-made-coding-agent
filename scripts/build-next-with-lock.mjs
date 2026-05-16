#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const lockDir = path.join(process.cwd(), ".next-build.lock");
const nextBin = path.join(process.cwd(), "node_modules", ".bin", "next");

let lockAcquired = false;

while (!lockAcquired) {
  try {
    fs.mkdirSync(lockDir);
    lockAcquired = true;
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
    console.log("Waiting for active Next build to finish...");
    await new Promise((resolve) => setTimeout(resolve, 1000));
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
});

cleanup();
process.exit(result.status ?? 1);
