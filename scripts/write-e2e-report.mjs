#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const args = parseArgs(process.argv.slice(2));
const requestPath = args.request;
const startedAt = args.started_at;
const endedAt = args.ended_at || new Date().toISOString();
const exitCode = Number(args.exit_code ?? 1);

if (!requestPath || !startedAt) {
  console.error("Usage: node scripts/write-e2e-report.mjs --request <path> --started-at <iso>");
  process.exit(1);
}

const request = readJson(requestPath) ?? {};
const requestId = stringOrNull(request.request_id) ?? "unknown-request";
const companyId = stringOrNull(request.company_id) ?? "unknown-company";
const sitePath = path.join("generated-sites", companyId);
const resultPath = path.join(sitePath, "generation-result.json");
const validationReportPath = path.join(sitePath, "validation-report.json");
const generationResult = readJson(resultPath) ?? {};
const validationReport = readJson(validationReportPath) ?? {};
const reportDir = path.join("reports", "e2e");
const timestamp = toFileTimestamp(endedAt);
const reportBaseName = `${timestamp}-${sanitizeFileName(requestId)}`;
const reportJsonPath = path.join(reportDir, `${reportBaseName}.json`);
const reportMdPath = path.join(reportDir, `${reportBaseName}.md`);
const latestJsonPath = path.join(reportDir, "latest.json");
const latestMdPath = path.join(reportDir, "latest.md");
const modelInfo = readGooseModelInfo();

const report = {
  report_type: "goose_e2e",
  request_path: requestPath,
  request_id: requestId,
  company_id: companyId,
  goose_version: readGooseVersion(),
  model_provider: modelInfo.provider,
  model_name: modelInfo.model,
  started_at: startedAt,
  ended_at: endedAt,
  duration_ms: Math.max(0, Date.parse(endedAt) - Date.parse(startedAt)),
  exit_code: exitCode,
  generated_site_path: sitePath,
  final_status: stringOrNull(generationResult.status),
  validation_passed: booleanOrNull(generationResult.validation_result?.passed ?? validationReport.passed),
  build_passed: booleanOrNull(generationResult.build_result?.passed),
  retry_count: numberOrNull(generationResult.retry_count),
  quota_or_rate_limit_warning: parseBoolean(args.quota_warning),
  preview_url: `/homepage/${companyId}`,
};

fs.mkdirSync(reportDir, { recursive: true });
fs.writeFileSync(reportJsonPath, JSON.stringify(report, null, 2));
fs.writeFileSync(reportMdPath, renderMarkdown(report));
fs.writeFileSync(latestJsonPath, JSON.stringify({ ...report, report_path: reportJsonPath }, null, 2));
fs.writeFileSync(latestMdPath, renderMarkdown({ ...report, report_path: reportJsonPath }));

console.log(reportJsonPath);

function parseArgs(rawArgs) {
  const parsed = {};
  for (let index = 0; index < rawArgs.length; index += 1) {
    const arg = rawArgs[index];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2).replaceAll("-", "_");
    parsed[key] = rawArgs[index + 1] ?? "";
    index += 1;
  }
  return parsed;
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function readGooseVersion() {
  try {
    return execFileSync("goose", ["--version"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
}

function readGooseModelInfo() {
  const configCandidates = [
    process.env.GOOSE_PATH_ROOT
      ? path.join(process.env.GOOSE_PATH_ROOT, "config", "config.yaml")
      : null,
    path.join(process.env.HOME ?? "", ".config", "goose", "config.yaml"),
    path.join(
      process.env.HOME ?? "",
      "Library",
      "Application Support",
      "Block",
      "goose",
      "config",
      "config.yaml",
    ),
  ].filter(Boolean);

  const provider = process.env.GOOSE_PROVIDER || readFirstConfigValue(configCandidates, [
    "GOOSE_PROVIDER",
    "provider",
  ]);
  const model = process.env.GOOSE_MODEL || readFirstConfigValue(configCandidates, [
    "GOOSE_MODEL",
    "model",
  ]);

  return {
    provider: provider || null,
    model: model || null,
  };
}

function readFirstConfigValue(filePaths, keys) {
  for (const filePath of filePaths) {
    if (!fs.existsSync(filePath)) continue;
    const lines = fs.readFileSync(filePath, "utf8").split("\n");
    for (const key of keys) {
      const found = lines
        .map((line) => line.trim())
        .find((line) => line.startsWith(`${key}:`) || line.startsWith(`${key}=`));
      if (!found) continue;
      const value = found.includes(":") ? found.split(":").slice(1).join(":") : found.split("=").slice(1).join("=");
      return value.trim().replace(/^["']|["']$/g, "");
    }
  }

  return null;
}

function renderMarkdown(report) {
  return `# Goose E2E Report

## Summary

- request_id: ${report.request_id}
- company_id: ${report.company_id}
- request_path: ${report.request_path}
- generated_site_path: ${report.generated_site_path}
- preview_url: ${report.preview_url}
- final_status: ${report.final_status ?? "unknown"}
- exit_code: ${report.exit_code}

## Runtime

- goose_version: ${report.goose_version ?? "unknown"}
- model_provider: ${report.model_provider ?? "unknown"}
- model_name: ${report.model_name ?? "unknown"}
- started_at: ${report.started_at}
- ended_at: ${report.ended_at}
- duration_ms: ${report.duration_ms}
- quota_or_rate_limit_warning: ${report.quota_or_rate_limit_warning}

## Checks

- validation_passed: ${report.validation_passed}
- build_passed: ${report.build_passed}
- retry_count: ${report.retry_count}
${report.report_path ? `\n## Archive\n\n- report_path: ${report.report_path}\n` : ""}
`;
}

function toFileTimestamp(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return new Date().toISOString().replaceAll(/[:.]/g, "-");
  return date.toISOString().replaceAll(/[:.]/g, "-");
}

function sanitizeFileName(value) {
  return String(value).replaceAll(/[^A-Za-z0-9_-]/g, "_");
}

function stringOrNull(value) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function numberOrNull(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function booleanOrNull(value) {
  return typeof value === "boolean" ? value : null;
}

function parseBoolean(value) {
  return value === "true";
}
