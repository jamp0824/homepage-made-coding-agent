#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const jobsRoot = process.argv[2] || "jobs";
assertAllowedJobsRoot(jobsRoot);
const pendingDir = path.join(jobsRoot, "pending");
const processingDir = path.join(jobsRoot, "processing");
const completedDir = path.join(jobsRoot, "completed");
const failedDir = path.join(jobsRoot, "failed");
const reportJsonPath = path.join(jobsRoot, "batch-run-report.json");
const reportMdPath = path.join(jobsRoot, "batch-run-report.md");

for (const dir of [pendingDir, processingDir, completedDir, failedDir]) {
  fs.mkdirSync(dir, { recursive: true });
}

const pendingJobs = fs
  .readdirSync(pendingDir, { withFileTypes: true })
  .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
  .map((entry) => entry.name)
  .sort();

const startedAt = new Date().toISOString();
const results = [];

for (const fileName of pendingJobs) {
  const pendingPath = path.join(pendingDir, fileName);
  const processingPath = path.join(processingDir, fileName);
  const request = readRequestSummary(pendingPath);
  const startedAtForJob = new Date().toISOString();

  try {
    if (process.env.HOMEPAGE_TEST_REMOVE_PENDING_BEFORE_RENAME === fileName) {
      fs.rmSync(pendingPath, { force: true });
    }
    fs.renameSync(pendingPath, processingPath);
  } catch (error) {
    if (error?.code !== "ENOENT" && error?.code !== "EEXIST") throw error;
    results.push({
      request_id: request.request_id,
      company_id: request.company_id,
      source_file: fileName,
      destination: pendingPath,
      exit_code: null,
      status: "skipped",
      succeeded: false,
      skipped: true,
      started_at: startedAtForJob,
      completed_at: new Date().toISOString(),
      stdout_tail: [],
      stderr_tail: [],
      error_type: "pending_rename_skipped",
      error_message: `Pending job was already moved or unavailable: ${fileName}`,
      validation_passed: null,
      build_passed: null,
    });
    continue;
  }

  const run = spawnSync("bash", ["scripts/run-homepage-builder.sh", processingPath], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: process.env,
  });
  const result = readGenerationResult(request.company_id);
  const validationFailure = run.status !== 0 && outputIncludesValidationFailure(run);
  const finalStatus = result?.status || (run.status === 0 ? "generated" : validationFailure ? "validation_failed" : "agent_failed");
  const succeeded = run.status === 0 && ["generated", "published"].includes(finalStatus);
  const destinationPath = path.join(succeeded ? completedDir : failedDir, fileName);

  fs.renameSync(processingPath, destinationPath);
  updateGeneratedRunReportRequestPath(request.company_id, destinationPath);
  writeQueueJobReport(destinationPath, {
    request_id: request.request_id,
    company_id: request.company_id,
    source_file: fileName,
    destination: destinationPath,
    exit_code: run.status,
    status: finalStatus,
    succeeded,
    started_at: startedAtForJob,
    completed_at: new Date().toISOString(),
    stdout_tail: tail(run.stdout),
    stderr_tail: tail(run.stderr),
    error_type: result?.error_type || (validationFailure ? "validation_failed" : null),
    validation_passed: result?.validation_result?.passed ?? (validationFailure ? false : null),
    build_passed: result?.build_result?.passed ?? (validationFailure ? false : null),
  });

  results.push({
    request_id: request.request_id,
    company_id: request.company_id,
    source_file: fileName,
    destination: destinationPath,
    exit_code: run.status,
    status: finalStatus,
    succeeded,
    skipped: false,
    started_at: startedAtForJob,
    completed_at: new Date().toISOString(),
    stdout_tail: tail(run.stdout),
    stderr_tail: tail(run.stderr),
    error_type: result?.error_type || (validationFailure ? "validation_failed" : null),
    validation_passed: result?.validation_result?.passed ?? (validationFailure ? false : null),
    build_passed: result?.build_result?.passed ?? (validationFailure ? false : null),
  });
}

const summary = {
  total: results.length,
  completed: results.filter((result) => result.succeeded).length,
  failed: results.filter((result) => !result.succeeded && !result.skipped).length,
  skipped: results.filter((result) => result.skipped).length,
  generated: results.filter((result) => result.status === "generated").length,
  published: results.filter((result) => result.status === "published").length,
  manual_required: results.filter((result) => result.status === "manual_required").length,
};

const report = {
  jobs_root: jobsRoot,
  started_at: startedAt,
  completed_at: new Date().toISOString(),
  summary,
  results,
};

fs.writeFileSync(reportJsonPath, JSON.stringify(report, null, 2));
fs.writeFileSync(reportMdPath, renderMarkdownReport(report));
console.log(JSON.stringify(report.summary, null, 2));

if (summary.failed > 0) {
  process.exit(1);
}

function readRequestSummary(filePath) {
  try {
    const request = JSON.parse(fs.readFileSync(filePath, "utf8"));
    return {
      request_id: request.request_id || path.basename(filePath, ".json"),
      company_id: request.company_id || "UNKNOWN_COMPANY",
    };
  } catch {
    return {
      request_id: path.basename(filePath, ".json"),
      company_id: "UNKNOWN_COMPANY",
    };
  }
}

function readGenerationResult(companyId) {
  if (!/^[A-Za-z0-9_-]+$/.test(companyId)) return null;

  const resultPath = path.join("generated-sites", companyId, "generation-result.json");
  if (!fs.existsSync(resultPath)) return null;

  try {
    return JSON.parse(fs.readFileSync(resultPath, "utf8"));
  } catch {
    return null;
  }
}

function outputIncludesValidationFailure(run) {
  const combinedOutput = `${run.stdout || ""}\n${run.stderr || ""}`;
  return combinedOutput.includes("Request validation failed") || combinedOutput.includes('"passed": false');
}

function writeQueueJobReport(destinationPath, result) {
  const reportPath = `${destinationPath}.job-report.json`;
  fs.writeFileSync(reportPath, JSON.stringify(result, null, 2));
}

function updateGeneratedRunReportRequestPath(companyId, destinationPath) {
  if (!/^[A-Za-z0-9_-]+$/.test(companyId)) return;

  const reportJsonPath = path.join("generated-sites", companyId, "agent-run-report.json");
  const reportMdPath = path.join("generated-sites", companyId, "agent-run-report.md");

  if (fs.existsSync(reportJsonPath)) {
    try {
      const report = JSON.parse(fs.readFileSync(reportJsonPath, "utf8"));
      report.request_path = destinationPath;
      fs.writeFileSync(reportJsonPath, JSON.stringify(report, null, 2));
    } catch {
      // Keep the original report if it cannot be parsed.
    }
  }

  if (fs.existsSync(reportMdPath)) {
    const markdown = fs.readFileSync(reportMdPath, "utf8");
    fs.writeFileSync(
      reportMdPath,
      markdown.replace(/- request_path: .*/u, `- request_path: ${destinationPath}`),
    );
  }
}

function assertAllowedJobsRoot(rawJobsRoot) {
  const absoluteJobsRoot = path.resolve(rawJobsRoot);
  const allowedRoots = [path.resolve("jobs"), path.resolve("harness", "tmp")];
  const allowed = allowedRoots.some(
    (root) => absoluteJobsRoot === root || absoluteJobsRoot.startsWith(`${root}${path.sep}`),
  );

  if (!allowed) {
    console.error(`Refusing to operate on jobs root outside jobs/ or harness/tmp/: ${rawJobsRoot}`);
    process.exit(1);
  }
}

function tail(output) {
  return String(output || "")
    .trim()
    .split("\n")
    .filter(Boolean)
    .slice(-20);
}

function renderMarkdownReport(report) {
  const rows = report.results
    .map(
      (result) =>
        `| ${result.request_id} | ${result.company_id} | ${result.status} | ${formatOutcome(result)} | ${result.destination} |`,
    )
    .join("\n");

  return `# Batch Run Report

## Summary

- jobs_root: ${report.jobs_root}
- total: ${report.summary.total}
- completed: ${report.summary.completed}
- failed: ${report.summary.failed}
- skipped: ${report.summary.skipped}
- generated: ${report.summary.generated}
- published: ${report.summary.published}
- manual_required: ${report.summary.manual_required}
- started_at: ${report.started_at}
- completed_at: ${report.completed_at}

## Jobs

| Request | Company | Status | Queue Result | Destination |
| --- | --- | --- | --- | --- |
${rows || "| none | none | none | none | none |"}
`;
}

function formatOutcome(result) {
  if (result.skipped) return "skipped";
  return result.succeeded ? "completed" : "failed";
}
