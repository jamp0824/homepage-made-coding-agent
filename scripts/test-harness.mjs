#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import {
  enqueueHomepageGenerationJob,
  synthesizeHomepageGenerationJobStatus,
} from "./lib/homepage-job-queue.mjs";

const tests = [];
const asyncQueueState = {};

runTest("valid request schema: company intro", () => {
  run("node", ["scripts/validate-request.mjs", "requests/sample-company-intro.json"]);
});

runTest("valid request schema: product empty", () => {
  run("node", ["scripts/validate-request.mjs", "requests/sample-product-empty.json"]);
});

runTest("valid request schema: product with items", () => {
  run("node", ["scripts/validate-request.mjs", "requests/sample-product-with-items.json"]);
});

runTest("valid request schema: result style full", () => {
  run("node", ["scripts/validate-request.mjs", "harness/fixtures/company-intro-result-style-full.json"]);
});

runTest("valid request schema: result style empty optionals", () => {
  run("node", [
    "scripts/validate-request.mjs",
    "harness/fixtures/company-intro-result-style-empty-optionals.json",
  ]);
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

runTest("result style full fixture renders request-bound optional sections", () => {
  run("bash", [
    "scripts/run-homepage-builder.sh",
    "harness/fixtures/company-intro-result-style-full.json",
  ]);
  assertResult("generated-sites/COMPANY_RESULT_STYLE_FULL/generation-result.json", {
    status: "generated",
    buildPassed: true,
    validationPassed: true,
  });

  const content = readJson("generated-sites/COMPANY_RESULT_STYLE_FULL/content.json");
  const metadata = readJson("generated-sites/COMPANY_RESULT_STYLE_FULL/metadata.json");
  assert(content.template_variant === "result_style_v1", "content must record result_style_v1");
  assert(metadata.template_variant === "result_style_v1", "metadata must record result_style_v1");
  assert(content.sections.includes("contact_info"), "full fixture must render contact_info");
  assert(content.sections.includes("history"), "full fixture must render history");
  assert(content.sections.includes("portfolio"), "full fixture must render portfolio");
  assert(content.sections.includes("featured_products"), "full fixture must render featured_products");
  assert(content.tags.includes("스마트팩토리"), "full fixture must render request tags");
  assert(content.contact.email === "hello@example.com", "full fixture must render request contact");
});

runTest("result style empty fixture hides optional sections", () => {
  run("bash", [
    "scripts/run-homepage-builder.sh",
    "harness/fixtures/company-intro-result-style-empty-optionals.json",
  ]);
  assertResult("generated-sites/COMPANY_RESULT_STYLE_EMPTY/generation-result.json", {
    status: "generated",
    buildPassed: true,
    validationPassed: true,
  });

  const content = readJson("generated-sites/COMPANY_RESULT_STYLE_EMPTY/content.json");
  assert(content.template_variant === "result_style_v1", "empty fixture must use result style");
  for (const hiddenSection of ["contact_info", "history", "portfolio", "featured_products"]) {
    assert(
      !content.sections.includes(hiddenSection),
      `empty fixture must not render ${hiddenSection}`,
    );
  }
  assert(content.tags.length === 0, "empty fixture must not invent tags");
  assert(Object.keys(content.contact).length === 0, "empty fixture must not invent contact");
});

runTest("result style request-bound contact, tags, cover, and products are enforced", () => {
  run("bash", [
    "scripts/run-homepage-builder.sh",
    "harness/fixtures/company-intro-result-style-fake-contact.json",
  ]);

  const contentPath = path.join(
    process.cwd(),
    "generated-sites",
    "COMPANY_RESULT_STYLE_FAKE",
    "content.json",
  );
  const assetsPath = path.join(
    process.cwd(),
    "generated-sites",
    "COMPANY_RESULT_STYLE_FAKE",
    "assets.json",
  );
  const originalContent = fs.readFileSync(contentPath, "utf8");
  const originalAssets = fs.readFileSync(assetsPath, "utf8");
  const content = JSON.parse(originalContent);
  const assets = JSON.parse(originalAssets);
  content.tags.push("요청에 없는 태그");
  content.contact.phone = "02-0000-0000";
  content.cover_image_url = "https://example.com/fake-cover.jpg";
  content.products.push({ name: "요청에 없는 상품", description: "허위 상품" });
  content.sections.push("featured_products");
  assets.hero_image = "https://example.com/fake-cover.jpg";

  try {
    fs.writeFileSync(contentPath, JSON.stringify(content, null, 2));
    fs.writeFileSync(assetsPath, JSON.stringify(assets, null, 2));
    runExpectFailure("bash", [
      "scripts/validate-generated-site.sh",
      "generated-sites/COMPANY_RESULT_STYLE_FAKE",
      "harness/fixtures/company-intro-result-style-fake-contact.json",
    ]);
  } finally {
    fs.writeFileSync(contentPath, originalContent);
    fs.writeFileSync(assetsPath, originalAssets);
    run("bash", [
      "scripts/validate-generated-site.sh",
      "generated-sites/COMPANY_RESULT_STYLE_FAKE",
      "harness/fixtures/company-intro-result-style-fake-contact.json",
    ]);
  }
});

runTest("result style provided optional fields must be rendered", () => {
  run("bash", [
    "scripts/run-homepage-builder.sh",
    "harness/fixtures/company-intro-result-style-full.json",
  ]);

  const sitePath = path.join(process.cwd(), "generated-sites", "COMPANY_RESULT_STYLE_FULL");
  const contentPath = path.join(sitePath, "content.json");
  const assetsPath = path.join(sitePath, "assets.json");
  const originalContent = fs.readFileSync(contentPath, "utf8");
  const originalAssets = fs.readFileSync(assetsPath, "utf8");
  const content = JSON.parse(originalContent);
  const assets = JSON.parse(originalAssets);
  content.tags = [];
  content.contact = {};
  content.cover_image_url = "";
  content.products = [];
  content.history = [];
  content.portfolio = [];
  content.sections = content.sections.filter(
    (section) => !["contact_info", "history", "portfolio", "featured_products"].includes(section),
  );
  assets.hero_image = `${assets.asset_theme}/neutral-cover-fallback`;
  assets.fallback_used = true;

  try {
    fs.writeFileSync(contentPath, JSON.stringify(content, null, 2));
    fs.writeFileSync(assetsPath, JSON.stringify(assets, null, 2));
    runExpectFailure("bash", [
      "scripts/validate-generated-site.sh",
      "generated-sites/COMPANY_RESULT_STYLE_FULL",
      "harness/fixtures/company-intro-result-style-full.json",
    ]);
  } finally {
    fs.writeFileSync(contentPath, originalContent);
    fs.writeFileSync(assetsPath, originalAssets);
    run("bash", [
      "scripts/validate-generated-site.sh",
      "generated-sites/COMPANY_RESULT_STYLE_FULL",
      "harness/fixtures/company-intro-result-style-full.json",
    ]);
  }
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
  run("node", [
    "scripts/create-homepage-job.mjs",
    "--jobs-root",
    jobsRoot,
    "--job-id",
    "JOB_CREATE_CUSTOM",
    "--request-id",
    "REQ_CREATE_002",
    "--company-id",
    "COMPANY_CREATE_002",
    "--homepage-type",
    "company_intro",
    "--company-name",
    "주식회사 생성테스트2",
    "--industry",
    "IT·소프트웨어",
    "--business-type",
    "소프트웨어 개발 및 공급",
    "--main-business-description",
    "업무 자동화 솔루션을 개발하고 기업에 공급합니다.",
  ]);
  assert(
    fs.existsSync(path.join(process.cwd(), jobsRoot, "pending", "JOB_CREATE_CUSTOM.json")),
    "job creator must support custom job_id",
  );
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

runTest("api routes enqueue, expose stale hint, process generated, and expose failed status", async () => {
  const jobsRoot = path.join("harness", "tmp", "api-route-generation-jobs");
  const companyId = "COMPANY_API_ROUTE_QUEUED";
  const failedJobId = "JOB_API_ROUTE_FAILED";
  const sitePath = path.join(process.cwd(), "generated-sites", companyId);
  let queuedJobId = "";

  fs.rmSync(path.join(process.cwd(), jobsRoot), { force: true, recursive: true });
  fs.rmSync(sitePath, { force: true, recursive: true });

  await withNextDevServer(
    {
      HOMEPAGE_JOBS_ROOT: jobsRoot,
      HOMEPAGE_JOB_STALE_MS: "1",
      GOOSE_MODE: "local",
    },
    async (baseUrl) => {
      const request = {
        ...buildAsyncRequest("REQ_API_ROUTE_QUEUED", companyId),
        generation_mode: "auto",
      };
      const postResponse = await fetch(`${baseUrl}/api/homepage-generation-jobs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });
      const queued = await postResponse.json();
      const queuedPath = path.join(process.cwd(), jobsRoot, "pending", `${queued.job_id}.json`);
      const queuedRequest = JSON.parse(fs.readFileSync(queuedPath, "utf8"));
      queuedJobId = queued.job_id;

      assert(postResponse.status === 202, "api POST must return 202");
      assert(queued.status === "queued", "api POST must return queued status");
      assert(queued.customer.preview_available === false, "api queued response must not expose preview");
      assert(fs.existsSync(queuedPath), "api POST must write pending job");
      assert(!("generation_mode" in queuedRequest), "api POST must strip transport generation_mode");
      assert(!fs.existsSync(sitePath), "api POST must not build generated site");

      const oldTime = new Date(Date.now() - 60_000);
      fs.utimesSync(queuedPath, oldTime, oldTime);
      const staleResponse = await fetch(`${baseUrl}/api/homepage-generation-jobs/${queued.job_id}`);
      const stale = await staleResponse.json();
      assert(stale.status === "queued", "stale pending job must remain queued");
      assert(Boolean(stale.customer.message), "stale pending job must expose safe customer message");
      assert(
        stale.debug.worker_hint === "Run npm run jobs:run in a separate terminal.",
        "stale pending job must expose debug worker hint",
      );
    },
  );

  run("npm", ["run", "jobs:run", "--", jobsRoot], {
    env: {
      ...process.env,
      GOOSE_MODE: "local",
    },
  });

  await withNextDevServer(
    {
      HOMEPAGE_JOBS_ROOT: jobsRoot,
      GOOSE_MODE: "local",
    },
    async (baseUrl) => {
      const generatedResponse = await fetch(`${baseUrl}/api/homepage-generation-jobs/${queuedJobId}`);
      const generated = await generatedResponse.json();
      assert(generated.status === "generated", "api-created worker job must become generated");
      assert(generated.customer.preview_available === true, "generated api job must expose preview");
      assert(generated.debug.validation_result.passed === true, "generated api job must expose validation");
      assert(generated.debug.build_result.passed === true, "generated api job must expose build");
      assert(
        generated.debug.job_report_path === `${jobsRoot}/completed/${queuedJobId}.json.job-report.json`,
        "generated api job must expose completed job report path",
      );
    },
  );

  for (const dir of ["pending", "processing", "completed", "failed"]) {
    fs.mkdirSync(path.join(process.cwd(), jobsRoot, dir), { recursive: true });
  }
  fs.copyFileSync(
    path.join(process.cwd(), "harness", "fixtures", "invalid-homepage-type.json"),
    path.join(process.cwd(), jobsRoot, "pending", `${failedJobId}.json`),
  );
  run("npm", ["run", "jobs:run", "--", jobsRoot], {
    expectFailure: true,
    env: {
      ...process.env,
      GOOSE_MODE: "local",
    },
  });

  await withNextDevServer(
    {
      HOMEPAGE_JOBS_ROOT: jobsRoot,
      GOOSE_MODE: "local",
    },
    async (baseUrl) => {
      const failedResponse = await fetch(`${baseUrl}/api/homepage-generation-jobs/${failedJobId}`);
      const failed = await failedResponse.json();
      assert(failed.status === "failed", "failed api job must synthesize failed status");
      assert(failed.customer.preview_available === false, "failed api job must not expose preview");
      assert(
        failed.debug.job_report_path === `${jobsRoot}/failed/${failedJobId}.json.job-report.json`,
        "failed api job must expose failed job report path",
      );
      assert(failed.debug.validation_result.passed === false, "failed api job must expose validation failure");
    },
  );
});

runTest("async generation enqueue returns queued without building", () => {
  const jobsRoot = path.join("harness", "tmp", "api-generation-jobs");
  const companyId = "COMPANY_ASYNC_QUEUED";
  const request = buildAsyncRequest("REQ_ASYNC_QUEUED", companyId);
  const sitePath = path.join(process.cwd(), "generated-sites", companyId);

  fs.rmSync(path.join(process.cwd(), jobsRoot), { force: true, recursive: true });
  fs.rmSync(sitePath, { force: true, recursive: true });

  const startedAt = Date.now();
  const queued = enqueueHomepageGenerationJob({
    requestBody: request,
    jobsRoot,
    jobId: "JOB_ASYNC_QUEUED",
    now: "2026-05-23T00:00:00.000Z",
  });
  const elapsedMs = Date.now() - startedAt;
  const queuedPath = path.join(process.cwd(), jobsRoot, "pending", "JOB_ASYNC_QUEUED.json");
  const queuedRequest = readJson(path.join(jobsRoot, "pending", "JOB_ASYNC_QUEUED.json"));

  assert(queued.status === "queued", "enqueue must return queued status");
  assert(queued.customer.status === "queued", "customer status must be queued");
  assert(queued.customer.preview_available === false, "queued job must not expose preview");
  assert(!("stdout" in queued), "queued response must not include top-level stdout");
  assert(!("stderr" in queued), "queued response must not include top-level stderr");
  assert(fs.existsSync(queuedPath), "enqueue must write pending job request");
  assert(queuedRequest.company_id === companyId, "queued request must preserve company_id");
  assert(!("job_id" in queuedRequest), "queued request must not include job_id");
  assert(!("status" in queuedRequest), "queued request must not include status");
  assert(!("generation_mode" in queuedRequest), "queued request must not include generation_mode");
  assert(!fs.existsSync(sitePath), "enqueue must not create generated site directory");
  assert(elapsedMs < 3000, "enqueue must not wait for build");

  asyncQueueState.jobsRoot = jobsRoot;
  asyncQueueState.completedJobId = "JOB_ASYNC_QUEUED";
  asyncQueueState.completedCompanyId = companyId;
});

runTest("batch runner skips pending rename race and continues", () => {
  const jobsRoot = path.join("harness", "tmp", "rename-race-jobs");
  const skippedFile = "rename-race.json";

  fs.rmSync(path.join(process.cwd(), jobsRoot), { force: true, recursive: true });
  fs.mkdirSync(path.join(process.cwd(), jobsRoot, "pending"), { recursive: true });
  fs.copyFileSync(
    path.join(process.cwd(), "requests", "sample-company-intro.json"),
    path.join(process.cwd(), jobsRoot, "pending", skippedFile),
  );

  run("npm", ["run", "jobs:run", "--", jobsRoot], {
    env: {
      ...process.env,
      HOMEPAGE_TEST_REMOVE_PENDING_BEFORE_RENAME: skippedFile,
    },
  });

  const report = readJson(path.join(jobsRoot, "batch-run-report.json"));
  assert(report.summary.skipped === 1, "batch report must record skipped rename race");
  assert(report.summary.failed === 0, "skipped rename race must not count as failed job");
  assert(report.results[0].status === "skipped", "rename race result must be skipped");
});

runTest("async status helper synthesizes queued and running states", () => {
  const jobsRoot = path.join("harness", "tmp", "api-generation-status");
  const queuedRequest = buildAsyncRequest("REQ_ASYNC_STATUS_QUEUED", "COMPANY_ASYNC_STATUS_QUEUED");
  const runningRequest = buildAsyncRequest("REQ_ASYNC_STATUS_RUNNING", "COMPANY_ASYNC_STATUS_RUNNING");

  fs.rmSync(path.join(process.cwd(), jobsRoot), { force: true, recursive: true });
  for (const dir of ["pending", "processing", "completed", "failed"]) {
    fs.mkdirSync(path.join(process.cwd(), jobsRoot, dir), { recursive: true });
  }
  fs.writeFileSync(
    path.join(process.cwd(), jobsRoot, "pending", "JOB_ASYNC_STATUS_QUEUED.json"),
    JSON.stringify(queuedRequest, null, 2),
  );
  fs.writeFileSync(
    path.join(process.cwd(), jobsRoot, "processing", "JOB_ASYNC_STATUS_RUNNING.json"),
    JSON.stringify(runningRequest, null, 2),
  );

  const queued = synthesizeHomepageGenerationJobStatus({
    jobsRoot,
    jobId: "JOB_ASYNC_STATUS_QUEUED",
  });
  const running = synthesizeHomepageGenerationJobStatus({
    jobsRoot,
    jobId: "JOB_ASYNC_STATUS_RUNNING",
  });

  assert(queued.status === "queued", "pending queue state must synthesize queued status");
  assert(queued.debug.queue_state === "pending", "queued debug state must be pending");
  assert(queued.customer.preview_available === false, "queued status must not expose preview");
  assert(running.status === "running", "processing queue state must synthesize running status");
  assert(running.debug.queue_state === "processing", "running debug state must be processing");
  assert(running.customer.preview_available === false, "running status must not expose preview");
});

runTest("worker moves async queued job to completed and status helper exposes generated telemetry", () => {
  const jobsRoot = asyncQueueState.jobsRoot;
  const jobId = asyncQueueState.completedJobId;
  const companyId = asyncQueueState.completedCompanyId;

  assert(jobsRoot && jobId && companyId, "async queued state must be initialized");
  run("npm", ["run", "jobs:run", "--", jobsRoot], {
    env: {
      ...process.env,
      GOOSE_MODE: "local",
    },
  });

  assert(
    !fs.existsSync(path.join(process.cwd(), jobsRoot, "pending", `${jobId}.json`)),
    "worker must remove pending job",
  );
  assert(
    fs.existsSync(path.join(process.cwd(), jobsRoot, "completed", `${jobId}.json`)),
    "worker must move successful job to completed",
  );
  assert(
    fs.existsSync(path.join(process.cwd(), jobsRoot, "completed", `${jobId}.json.job-report.json`)),
    "worker must write completed job report",
  );
  assertResult(`generated-sites/${companyId}/generation-result.json`, {
    status: "generated",
    buildPassed: true,
    validationPassed: true,
  });

  const status = synthesizeHomepageGenerationJobStatus({ jobsRoot, jobId });
  assert(status.status === "generated", "completed queue job must synthesize generated status");
  assert(
    status.customer.homepage_url === `/homepage/${companyId}`,
    "generated status must expose homepage url",
  );
  assert(status.customer.preview_available === true, "generated status must expose preview");
  assert(status.debug.validation_result.passed === true, "generated debug must include validation result");
  assert(status.debug.build_result.passed === true, "generated debug must include build result");
  assert(
    status.debug.agent_run_report_path === `generated-sites/${companyId}/agent-run-report.json`,
    "generated debug must expose agent run report path",
  );
});

runTest("async status helper synthesizes failed state from failed queue", () => {
  const jobsRoot = path.join("harness", "tmp", "api-generation-failed-jobs");
  const jobId = "JOB_ASYNC_FAILED";

  fs.rmSync(path.join(process.cwd(), jobsRoot), { force: true, recursive: true });
  for (const dir of ["pending", "processing", "completed", "failed"]) {
    fs.mkdirSync(path.join(process.cwd(), jobsRoot, dir), { recursive: true });
  }
  fs.copyFileSync(
    path.join(process.cwd(), "harness", "fixtures", "invalid-homepage-type.json"),
    path.join(process.cwd(), jobsRoot, "pending", `${jobId}.json`),
  );

  run("npm", ["run", "jobs:run", "--", jobsRoot], {
    expectFailure: true,
    env: {
      ...process.env,
      GOOSE_MODE: "local",
    },
  });

  assert(
    fs.existsSync(path.join(process.cwd(), jobsRoot, "failed", `${jobId}.json`)),
    "worker must move invalid job to failed",
  );
  assert(
    fs.existsSync(path.join(process.cwd(), jobsRoot, "failed", `${jobId}.json.job-report.json`)),
    "worker must write failed job report",
  );

  const status = synthesizeHomepageGenerationJobStatus({ jobsRoot, jobId });
  assert(status.status === "failed", "failed queue job must synthesize failed status");
  assert(status.customer.preview_available === false, "failed status must not expose preview");
  assert(status.debug.queue_state === "failed", "failed debug state must be failed");
  assert(
    status.debug.job_report_path === `${jobsRoot}/failed/${jobId}.json.job-report.json`,
    "failed debug must expose job report path",
  );
});

runTest("goose required without provider records agent failure without stale validation", () => {
  if (!hasGooseCli()) {
    console.log("skip - goose CLI is not installed");
    return;
  }

  const request = readJson("requests/sample-company-intro.json");
  request.request_id = "REQ_GOOSE_NO_PROVIDER";
  request.company_id = "COMPANY_GOOSE_NO_PROVIDER";

  const requestDir = path.join(process.cwd(), "harness", "tmp", "goose-no-provider");
  const requestPath = path.join(requestDir, "request.json");
  const sitePath = path.join(process.cwd(), "generated-sites", request.company_id);
  const goosePathRoot = path.join(requestDir, "goose-runtime");

  fs.rmSync(requestDir, { force: true, recursive: true });
  fs.rmSync(sitePath, { force: true, recursive: true });
  fs.mkdirSync(requestDir, { recursive: true });
  fs.writeFileSync(requestPath, JSON.stringify(request, null, 2));

  run("bash", ["scripts/run-homepage-builder.sh", requestPath], {
    expectFailure: true,
    env: {
      ...process.env,
      GOOSE_MODE: "required",
      MAX_RETRY: "1",
      GOOSE_PATH_ROOT: goosePathRoot,
      GOOSE_PROVIDER: "",
      GOOSE_MODEL: "",
    },
  });

  assertResult("generated-sites/COMPANY_GOOSE_NO_PROVIDER/generation-result.json", {
    status: "manual_required",
    buildPassed: false,
    validationPassed: false,
  });

  const result = readJson("generated-sites/COMPANY_GOOSE_NO_PROVIDER/generation-result.json");
  const runReport = readJson("generated-sites/COMPANY_GOOSE_NO_PROVIDER/agent-run-report.json");

  assert(
    result.validation_result.errors.some((error) =>
      error.includes("agent failed before generated-site validation"),
    ),
    "goose preflight failure must not reuse stale validation success",
  );
  assert(
    runReport.timeline.some(
      (event) => event.step === "validating_output" && event.status === "skipped",
    ),
    "goose preflight failure must mark generated-site validation as skipped",
  );
});

runTest("goose required without CLI records manual_required", () => {
  const request = readJson("requests/sample-company-intro.json");
  request.request_id = "REQ_GOOSE_MISSING_CLI";
  request.company_id = "COMPANY_GOOSE_MISSING_CLI";

  const requestDir = path.join(process.cwd(), "harness", "tmp", "goose-missing-cli");
  const requestPath = path.join(requestDir, "request.json");
  const sitePath = path.join(process.cwd(), "generated-sites", request.company_id);
  const fakeHome = path.join(requestDir, "home");

  fs.rmSync(requestDir, { force: true, recursive: true });
  fs.rmSync(sitePath, { force: true, recursive: true });
  fs.mkdirSync(fakeHome, { recursive: true });
  fs.writeFileSync(requestPath, JSON.stringify(request, null, 2));

  run("bash", ["scripts/run-homepage-builder.sh", requestPath], {
    expectFailure: true,
    env: {
      ...process.env,
      GOOSE_MODE: "required",
      HOME: fakeHome,
      MAX_RETRY: "1",
      PATH: `${path.dirname(process.execPath)}:/usr/bin:/bin:/usr/sbin:/sbin`,
    },
  });

  assertResult("generated-sites/COMPANY_GOOSE_MISSING_CLI/generation-result.json", {
    status: "manual_required",
    buildPassed: false,
    validationPassed: false,
  });

  const result = readJson("generated-sites/COMPANY_GOOSE_MISSING_CLI/generation-result.json");
  assert(
    result.errors.some((error) => error.includes("goose command was not found")),
    "missing Goose CLI must be recorded in generation-result errors",
  );
});

let failed = 0;
for (const test of tests) {
  try {
    await test.fn();
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

function hasGooseCli() {
  const result = spawnSync("bash", ["-lc", 'PATH="$HOME/.local/bin:$PATH" command -v goose'], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  return result.status === 0;
}

async function withNextDevServer(env, fn) {
  const port = 32000 + Math.floor(Math.random() * 1000);
  const baseUrl = `http://127.0.0.1:${port}`;
  const nextBin = path.join(process.cwd(), "node_modules", ".bin", "next");
  const child = spawn(nextBin, ["dev", "frontend", "--hostname", "127.0.0.1", "--port", String(port)], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      ...env,
      NEXT_TELEMETRY_DISABLED: "1",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const output = [];
  child.stdout.on("data", (chunk) => output.push(String(chunk)));
  child.stderr.on("data", (chunk) => output.push(String(chunk)));

  try {
    await waitForHttpServer(baseUrl, output);
    await fn(baseUrl);
  } finally {
    child.kill("SIGTERM");
    await new Promise((resolve) => {
      const timeout = setTimeout(resolve, 3000);
      child.once("exit", () => {
        clearTimeout(timeout);
        resolve();
      });
    });
  }
}

async function waitForHttpServer(baseUrl, output) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 30_000) {
    try {
      const response = await fetch(`${baseUrl}/api/generated-sites`);
      if (response.status < 500) return;
    } catch {
      // Server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(`Next dev server did not become ready:\n${output.join("").split("\n").slice(-40).join("\n")}`);
}

function buildAsyncRequest(requestId, companyId) {
  const request = readJson("requests/sample-company-intro.json");
  return {
    ...request,
    request_id: requestId,
    company_id: companyId,
    company_name: "주식회사 비동기테스트",
  };
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
