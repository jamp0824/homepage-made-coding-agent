#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const args = parseArgs(process.argv.slice(2));
const sitePath = args.site;
const requestPath = args.request;
const status = args.status;

if (!sitePath || !requestPath || !status) {
  console.error("Usage: node scripts/update-generation-result.mjs --site generated-sites/COMPANY_001 --request requests/sample-company-intro.json --status generated");
  process.exit(1);
}

assertGeneratedSitePath(sitePath);

const request = JSON.parse(fs.readFileSync(requestPath, "utf8"));
const templateId = request.homepage_type === "company_intro" ? "company_intro_basic" : "product_basic";
const resultPath = path.join(sitePath, "generation-result.json");
const reportPath = path.join(sitePath, "validation-report.json");
const agentRunReportJsonPath = path.join(sitePath, "agent-run-report.json");
const agentRunReportMdPath = path.join(sitePath, "agent-run-report.md");
const existing = fs.existsSync(resultPath)
  ? JSON.parse(fs.readFileSync(resultPath, "utf8"))
  : {};
const report = fs.existsSync(reportPath)
  ? JSON.parse(fs.readFileSync(reportPath, "utf8"))
  : { passed: false, errors: ["validation-report.json not found"], warnings: [] };
const buildErrors = args.build_errors ? [args.build_errors] : [];
const generatedFiles = fs.existsSync(sitePath)
  ? fs.readdirSync(sitePath).filter((fileName) => !fileName.startsWith(".")).sort()
  : [];

const result = {
  request_id: request.request_id,
  company_id: request.company_id,
  status,
  homepage_type: request.homepage_type,
  template_id: templateId,
  generated_path: sitePath,
  homepage_url: `/homepage/${request.company_id}`,
  model_provider: existing.model_provider || "local_placeholder",
  model_name: existing.model_name || "deterministic-template",
  generated_files: generatedFiles,
  build_result: {
    passed: args.build_passed === "true",
    command: args.build_command || "npm run build",
    errors: buildErrors,
  },
  validation_result: {
    passed: Boolean(report.passed),
    errors: report.errors || [],
    warnings: report.warnings || [],
  },
  retry_count: Number(args.retry_count || existing.retry_count || 0),
  completed_at: new Date().toISOString(),
};

if (args.error_type) result.error_type = args.error_type;
if (args.errors) result.errors = [args.errors];

const timeline = buildTimeline({
  status,
  retryCount: result.retry_count,
  validationPassed: result.validation_result.passed,
  buildPassed: result.build_result.passed,
  errorType: result.error_type,
});
const agentRunReport = {
  request_id: request.request_id,
  company_id: request.company_id,
  request_path: requestPath,
  generated_path: sitePath,
  homepage_type: request.homepage_type,
  template_id: templateId,
  final_status: status,
  retry_count: result.retry_count,
  model_provider: result.model_provider,
  model_name: result.model_name,
  validation_result: result.validation_result,
  build_result: result.build_result,
  error_type: result.error_type || null,
  errors: result.errors || [],
  timeline,
  completed_at: result.completed_at,
};

fs.mkdirSync(sitePath, { recursive: true });
fs.writeFileSync(resultPath, JSON.stringify(result, null, 2));
fs.writeFileSync(agentRunReportJsonPath, JSON.stringify(agentRunReport, null, 2));
fs.writeFileSync(agentRunReportMdPath, renderMarkdownReport(agentRunReport));
console.log(resultPath);

function parseArgs(rawArgs) {
  const parsed = {};
  for (let index = 0; index < rawArgs.length; index += 1) {
    const arg = rawArgs[index];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2).replaceAll("-", "_");
    parsed[key] = rawArgs[index + 1] || "";
    index += 1;
  }
  return parsed;
}

function assertGeneratedSitePath(rawSitePath) {
  const absoluteRoot = path.resolve("generated-sites");
  const absoluteSitePath = path.resolve(rawSitePath);
  const companyId = path.basename(absoluteSitePath);

  if (
    !absoluteSitePath.startsWith(`${absoluteRoot}${path.sep}`) ||
    !/^[A-Za-z0-9_-]+$/.test(companyId)
  ) {
    console.error(`Refusing to write generation result outside generated-sites/{company_id}: ${rawSitePath}`);
    process.exit(1);
  }
}

function buildTimeline({ status, retryCount, validationPassed, buildPassed, errorType }) {
  const timeline = [
    {
      step: "requested",
      status: "completed",
      message: "Request file was accepted by the runner.",
    },
    {
      step: "validating_request",
      status: "completed",
      message: "Request schema validation passed before generation.",
    },
    {
      step: "agent_running",
      status: "completed",
      message: "Homepage files were generated under generated-sites/{company_id}.",
    },
    {
      step: "validating_output",
      status: validationPassed ? "completed" : "failed",
      message: validationPassed
        ? "Generated-site validation passed."
        : "Generated-site validation failed.",
    },
    {
      step: "building",
      status: buildPassed ? "completed" : status === "validation_failed" ? "skipped" : "failed",
      message: buildPassed
        ? "Next.js build passed."
        : status === "validation_failed"
          ? "Build skipped because validation failed."
          : "Next.js build failed or was not completed.",
    },
    {
      step: status,
      status: status === "generated" || status === "published" ? "completed" : "failed",
      message:
        status === "manual_required"
          ? "Retry limit reached; automation failure was recorded."
          : `Final status recorded as ${status}.`,
    },
  ];

  return timeline.map((event) => ({
    ...event,
    retry_count: retryCount,
    error_type: event.status === "failed" ? errorType || null : null,
  }));
}

function renderMarkdownReport(report) {
  const validationErrors = report.validation_result.errors.length
    ? report.validation_result.errors.map((error) => `- ${error}`).join("\n")
    : "- none";
  const buildErrors = report.build_result.errors.length
    ? report.build_result.errors.map((error) => `- ${error}`).join("\n")
    : "- none";
  const timeline = report.timeline
    .map((event) => `| ${event.step} | ${event.status} | ${event.message} |`)
    .join("\n");

  return `# Agent Run Report

## Summary

- request_id: ${report.request_id}
- company_id: ${report.company_id}
- request_path: ${report.request_path}
- generated_path: ${report.generated_path}
- homepage_type: ${report.homepage_type}
- template_id: ${report.template_id}
- final_status: ${report.final_status}
- retry_count: ${report.retry_count}
- completed_at: ${report.completed_at}

## Validation

- passed: ${report.validation_result.passed}

${validationErrors}

## Build

- passed: ${report.build_result.passed}
- command: ${report.build_result.command}

${buildErrors}

## Timeline

| Step | Status | Message |
| --- | --- | --- |
${timeline}
`;
}
