#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import {
  enqueueHomepageGenerationJob,
  resolveHomepageJobsRoot,
} from "./lib/homepage-job-queue.mjs";

const args = parseArgs(process.argv.slice(2));
const jobsRoot = args.jobs_root || "jobs";
const safeJobsRoot = resolveHomepageJobsRoot(jobsRoot);

const requiredArgs = [
  "request_id",
  "company_id",
  "homepage_type",
  "company_name",
  "industry",
  "business_type",
  "main_business_description",
];
const missingArgs = requiredArgs.filter((arg) => !args[arg]);

if (missingArgs.length > 0 || args.help === "true") {
  printUsage(missingArgs);
  process.exit(missingArgs.length > 0 ? 1 : 0);
}

const request = {
  request_id: args.request_id,
  company_id: args.company_id,
  homepage_type: args.homepage_type,
  company_name: args.company_name,
  industry: args.industry,
  business_type: args.business_type,
  main_business_description: args.main_business_description,
  one_line_intro: args.one_line_intro || args.main_business_description,
  company_intro: args.company_intro || args.main_business_description,
  core_strengths: parseList(args.core_strengths),
  products: [],
  portfolio: [],
  history: [],
  preferred_style: args.preferred_style || "clean",
  created_at: args.created_at || new Date().toISOString(),
};

const jobId = args.job_id || request.request_id;

if (args.force === "true") {
  removeExistingQueueJob(safeJobsRoot, jobId);
}

let queued;
try {
  queued = enqueueHomepageGenerationJob({
    requestBody: request,
    jobsRoot: safeJobsRoot,
    jobId,
  });
} catch (error) {
  console.error(error instanceof Error ? error.message : "Job creation failed");
  if (error?.code === "JOB_EXISTS") console.error("Use --force to overwrite.");
  process.exit(1);
}

console.log(queued.debug.request_path);

function parseArgs(rawArgs) {
  const parsed = {};
  for (let index = 0; index < rawArgs.length; index += 1) {
    const arg = rawArgs[index];
    if (arg === "--help" || arg === "-h") {
      parsed.help = "true";
      continue;
    }
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2).replaceAll("-", "_");
    const nextValue = rawArgs[index + 1];
    if (!nextValue || nextValue.startsWith("--")) {
      parsed[key] = "true";
      continue;
    }
    parsed[key] = nextValue;
    index += 1;
  }
  return parsed;
}

function parseList(value) {
  if (!value) return [];
  return value
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean);
}

function removeExistingQueueJob(jobsRoot, jobId) {
  for (const state of ["pending", "processing", "completed", "failed"]) {
    for (const suffix of [".json", ".json.job-report.json"]) {
      fs.rmSync(path.join(jobsRoot, state, `${jobId}${suffix}`), { force: true });
    }
  }
}

function printUsage(missingArgs) {
  if (missingArgs.length > 0) {
    console.error(`Missing required args: ${missingArgs.join(", ")}`);
  }
  console.error(`
Usage:
  npm run jobs:create -- \\
    --request-id REQ_100 \\
    --company-id COMPANY_100 \\
    --homepage-type company_intro \\
    --company-name "주식회사 테스트" \\
    --industry "IT·소프트웨어" \\
    --business-type "소프트웨어 개발 및 공급" \\
    --main-business-description "업무 자동화 솔루션을 개발하고 기업에 공급합니다."

Optional:
  --one-line-intro "기업 업무 자동화 솔루션"
  --company-intro "업무 자동화 솔루션으로 반복 업무를 줄입니다."
  --core-strengths "업무 자동화|데이터 관리|기업 맞춤"
  --preferred-style clean
  --job-id JOB_100
  --jobs-root jobs
  --force
`);
}
