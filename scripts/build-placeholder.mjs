#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const generatedRoot = "generated-sites";

if (!fs.existsSync(generatedRoot)) {
  console.log("No generated-sites directory yet. Placeholder build passed.");
  process.exit(0);
}

const siteDirs = fs
  .readdirSync(generatedRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => path.join(generatedRoot, entry.name));

if (siteDirs.length === 0) {
  console.log("No generated sites yet. Placeholder build passed.");
  process.exit(0);
}

for (const sitePath of siteDirs) {
  const result = spawnSync(
    process.execPath,
    ["harness/validators/validate-generated-site.mjs", sitePath],
    { encoding: "utf8" },
  );

  if (result.status !== 0) {
    process.stderr.write(result.stdout);
    process.stderr.write(result.stderr);
    process.exit(result.status || 1);
  }
}

console.log(`Placeholder build passed for ${siteDirs.length} generated site(s).`);
