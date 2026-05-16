#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const tests = [];

runTest("valid request schema: company intro", () => {
  run("node", ["scripts/validate-request.mjs", "requests/sample-company-intro.json"]);
});

runTest("valid request schema: product empty", () => {
  run("node", ["scripts/validate-request.mjs", "requests/sample-product-empty.json"]);
});

runTest("valid request schema: product with items", () => {
  run("node", ["scripts/validate-request.mjs", "requests/sample-product-with-items.json"]);
});

runTest("invalid request fails before generation: missing company_name", () => {
  runExpectFailure("node", [
    "scripts/validate-request.mjs",
    "harness/fixtures/invalid-missing-company-name.json",
  ]);
});

runTest("invalid request fails before generation: unsupported homepage_type", () => {
  runExpectFailure("node", [
    "scripts/validate-request.mjs",
    "harness/fixtures/invalid-homepage-type.json",
  ]);
});

runTest("invalid request fails before generation: unsafe company_id path", () => {
  runExpectFailure("node", [
    "scripts/validate-request.mjs",
    "harness/fixtures/invalid-company-id-path.json",
  ]);
});

runTest("happy path pipeline: company intro", () => {
  run("bash", ["scripts/run-homepage-builder.sh", "requests/sample-company-intro.json"]);
  assertResult("generated-sites/COMPANY_001/generation-result.json", {
    status: "generated",
    buildPassed: true,
    validationPassed: true,
  });
});

runTest("happy path pipeline: product empty", () => {
  run("bash", ["scripts/run-homepage-builder.sh", "requests/sample-product-empty.json"]);
  assertResult("generated-sites/COMPANY_002/generation-result.json", {
    status: "generated",
    buildPassed: true,
    validationPassed: true,
  });

  const content = readJson("generated-sites/COMPANY_002/content.json");
  assert(content.products.length === 0, "product empty case must not generate product cards");
  assert(
    content.sections.includes("product_registration_cta"),
    "product empty case must include product_registration_cta",
  );
});

runTest("happy path pipeline: product with items", () => {
  run("bash", ["scripts/run-homepage-builder.sh", "requests/sample-product-with-items.json"]);
  assertResult("generated-sites/COMPANY_003/generation-result.json", {
    status: "generated",
    buildPassed: true,
    validationPassed: true,
  });
});

runTest("happy path pipeline: company intro with history and portfolio", () => {
  run("bash", [
    "scripts/run-homepage-builder.sh",
    "harness/fixtures/company-intro-history-portfolio.json",
  ]);
  assertResult("generated-sites/COMPANY_HISTORY_001/generation-result.json", {
    status: "generated",
    buildPassed: true,
    validationPassed: true,
  });

  const content = readJson("generated-sites/COMPANY_HISTORY_001/content.json");
  assert(content.sections.includes("history"), "history fixture must render history section");
  assert(content.sections.includes("portfolio"), "portfolio fixture must render portfolio section");
});

runTest("fake claim failure reaches manual_required", () => {
  run(
    "bash",
    ["scripts/run-homepage-builder.sh", "harness/fixtures/fake-claim-request.json"],
    {
      env: {
        ...process.env,
        INJECT_FAKE_CLAIM: "1",
        MAX_RETRY: "1",
      },
      expectFailure: true,
    },
  );

  assertResult("generated-sites/COMPANY_FAKE_CLAIM/generation-result.json", {
    status: "manual_required",
    buildPassed: false,
    validationPassed: false,
  });

  const result = readJson("generated-sites/COMPANY_FAKE_CLAIM/generation-result.json");
  assert(
    result.validation_result.errors.some((error) => error.includes("Unsupported high-risk phrase")),
    "manual_required result must include fake claim validation error",
  );
});

runTest("unsupported generation-result status fails validation", () => {
  const resultPath = path.join(
    process.cwd(),
    "generated-sites",
    "COMPANY_001",
    "generation-result.json",
  );
  const original = fs.readFileSync(resultPath, "utf8");
  const result = JSON.parse(original);
  result.status = "approved";

  try {
    fs.writeFileSync(resultPath, JSON.stringify(result, null, 2));
    runExpectFailure("bash", [
      "scripts/validate-generated-site.sh",
      "generated-sites/COMPANY_001",
      "requests/sample-company-intro.json",
    ]);
  } finally {
    fs.writeFileSync(resultPath, original);
    run("bash", [
      "scripts/validate-generated-site.sh",
      "generated-sites/COMPANY_001",
      "requests/sample-company-intro.json",
    ]);
  }
});

runTest("request-bound product descriptions, history, and portfolio are enforced", () => {
  run("bash", [
    "scripts/run-homepage-builder.sh",
    "harness/fixtures/company-intro-history-portfolio.json",
  ]);

  const contentPath = path.join(
    process.cwd(),
    "generated-sites",
    "COMPANY_HISTORY_001",
    "content.json",
  );
  const original = fs.readFileSync(contentPath, "utf8");
  const content = JSON.parse(original);
  content.history.push({ year: "2024", text: "요청에 없는 연혁입니다." });
  content.portfolio.push({ title: "요청에 없는 포트폴리오", description: "허위 항목" });

  try {
    fs.writeFileSync(contentPath, JSON.stringify(content, null, 2));
    runExpectFailure("bash", [
      "scripts/validate-generated-site.sh",
      "generated-sites/COMPANY_HISTORY_001",
      "harness/fixtures/company-intro-history-portfolio.json",
    ]);
  } finally {
    fs.writeFileSync(contentPath, original);
    run("bash", [
      "scripts/validate-generated-site.sh",
      "generated-sites/COMPANY_HISTORY_001",
      "harness/fixtures/company-intro-history-portfolio.json",
    ]);
  }
});

runTest("batch runner moves completed and failed jobs with report", () => {
  const jobsRoot = path.join("harness", "tmp", "batch-jobs");
  fs.rmSync(path.join(process.cwd(), jobsRoot), { force: true, recursive: true });
  for (const dir of ["pending", "processing", "completed", "failed"]) {
    fs.mkdirSync(path.join(process.cwd(), jobsRoot, dir), { recursive: true });
  }

  fs.copyFileSync(
    path.join(process.cwd(), "requests", "sample-company-intro.json"),
    path.join(process.cwd(), jobsRoot, "pending", "sample-company-intro.json"),
  );
  fs.copyFileSync(
    path.join(process.cwd(), "harness", "fixtures", "invalid-homepage-type.json"),
    path.join(process.cwd(), jobsRoot, "pending", "invalid-homepage-type.json"),
  );

  run("bash", ["scripts/run-pending-homepage-jobs.sh", jobsRoot], {
    expectFailure: true,
  });

  assert(
    fs.existsSync(path.join(process.cwd(), jobsRoot, "completed", "sample-company-intro.json")),
    "batch runner must move successful jobs to completed",
  );
  assert(
    fs.existsSync(path.join(process.cwd(), jobsRoot, "failed", "invalid-homepage-type.json")),
    "batch runner must move failed jobs to failed",
  );
  assert(
    fs.existsSync(
      path.join(process.cwd(), jobsRoot, "failed", "invalid-homepage-type.json.job-report.json"),
    ),
    "batch runner must write per-job failure report",
  );

  const report = readJson(path.join(jobsRoot, "batch-run-report.json"));
  assert(report.summary.total === 2, "batch report total must be 2");
  assert(report.summary.completed === 1, "batch report completed must be 1");
  assert(report.summary.failed === 1, "batch report failed must be 1");
  assert(
    fs.existsSync(path.join(process.cwd(), jobsRoot, "batch-run-report.md")),
    "batch markdown report must exist",
  );

  assert(
    report.results.some((result) => result.destination.includes("/completed/")),
    "batch report must include completed destination",
  );
  assert(
    report.results.some((result) => result.destination.includes("/failed/")),
    "batch report must include failed destination",
  );
  const failedJob = report.results.find((result) => result.destination.includes("/failed/"));
  assert(failedJob.status === "validation_failed", "invalid queued request must be validation_failed");
  assert(failedJob.validation_passed === false, "invalid queued request must record validation failure");
  const runReport = readJson("generated-sites/COMPANY_001/agent-run-report.json");
  assert(
    runReport.request_path.includes("/completed/"),
    "generated run report request_path must point to completed queue destination",
  );
});

runTest("job creator writes valid pending request and prevents overwrite", () => {
  const jobsRoot = path.join("harness", "tmp", "create-job");
  fs.rmSync(path.join(process.cwd(), jobsRoot), { force: true, recursive: true });

  run("node", [
    "scripts/create-homepage-job.mjs",
    "--jobs-root",
    jobsRoot,
    "--request-id",
    "REQ_CREATE_001",
    "--company-id",
    "COMPANY_CREATE_001",
    "--homepage-type",
    "company_intro",
    "--company-name",
    "주식회사 생성테스트",
    "--industry",
    "IT·소프트웨어",
    "--business-type",
    "소프트웨어 개발 및 공급",
    "--main-business-description",
    "업무 자동화 솔루션을 개발하고 기업에 공급합니다.",
    "--core-strengths",
    "업무 자동화|데이터 관리",
  ]);

  const createdPath = path.join(jobsRoot, "pending", "REQ_CREATE_001.json");
  assert(fs.existsSync(path.join(process.cwd(), createdPath)), "job creator must write pending job");
  run("node", ["scripts/validate-request.mjs", createdPath]);
  runExpectFailure("node", [
    "scripts/create-homepage-job.mjs",
    "--jobs-root",
    jobsRoot,
    "--request-id",
    "REQ_CREATE_001",
    "--company-id",
    "COMPANY_CREATE_001",
    "--homepage-type",
    "company_intro",
    "--company-name",
    "주식회사 생성테스트",
    "--industry",
    "IT·소프트웨어",
    "--business-type",
    "소프트웨어 개발 및 공급",
    "--main-business-description",
    "업무 자동화 솔루션을 개발하고 기업에 공급합니다.",
  ]);
});

let failed = 0;
for (const test of tests) {
  try {
    test.fn();
    console.log(`ok - ${test.name}`);
  } catch (error) {
    failed += 1;
    console.error(`not ok - ${test.name}`);
    console.error(error.message);
  }
}

if (failed > 0) {
  console.error(`${failed}/${tests.length} harness test(s) failed`);
  process.exit(1);
}

console.log(`${tests.length}/${tests.length} harness tests passed`);

function runTest(name, fn) {
  tests.push({ name, fn });
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    encoding: "utf8",
    env: {
      ...process.env,
      GOOSE_MODE: process.env.GOOSE_MODE || "local",
      ...(options.env || {}),
    },
  });

  const failed = result.status !== 0;
  if (failed && !options.expectFailure) {
    throw new Error(
      [
        `${command} ${args.join(" ")} failed with exit ${result.status}`,
        result.stdout,
        result.stderr,
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }

  if (!failed && options.expectFailure) {
    throw new Error(`${command} ${args.join(" ")} was expected to fail`);
  }

  return result;
}

function runExpectFailure(command, args) {
  run(command, args, { expectFailure: true });
}

function assertResult(resultPath, expected) {
  const result = readJson(resultPath);
  const sitePath = path.dirname(resultPath);
  const runReport = readJson(path.join(sitePath, "agent-run-report.json"));
  assert(result.status === expected.status, `${resultPath} status must be ${expected.status}`);
  assert(
    Boolean(result.build_result?.passed) === expected.buildPassed,
    `${resultPath} build_result.passed must be ${expected.buildPassed}`,
  );
  assert(
    Boolean(result.validation_result?.passed) === expected.validationPassed,
    `${resultPath} validation_result.passed must be ${expected.validationPassed}`,
  );
  assert(
    runReport.final_status === result.status,
    `${sitePath}/agent-run-report.json final_status must match generation-result status`,
  );
  assert(
    Array.isArray(runReport.timeline) && runReport.timeline.length > 0,
    `${sitePath}/agent-run-report.json must include timeline events`,
  );
  assert(
    fs.existsSync(path.join(process.cwd(), sitePath, "agent-run-report.md")),
    `${sitePath}/agent-run-report.md must exist`,
  );
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(path.join(process.cwd(), filePath), "utf8"));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
