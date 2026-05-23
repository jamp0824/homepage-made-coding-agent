import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const queueStates = ["pending", "processing", "completed", "failed"];
const lookupOrder = ["processing", "pending", "completed", "failed"];
const jobIdPattern = /^[A-Za-z0-9_-]+$/;
const queuedWorkerProvider = "queued_worker";
const staleQueuedMessage = "홈페이지 생성 작업이 대기 중입니다. 잠시 후 다시 확인해 주세요.";
const workerHint = "Run npm run jobs:run in a separate terminal.";
const defaultStaleAfterMs = 30 * 1000;

export function resolveHomepageJobsRoot(rawJobsRoot = process.env.HOMEPAGE_JOBS_ROOT || "jobs") {
  assertAllowedJobsRoot(rawJobsRoot);
  return rawJobsRoot;
}

/**
 * @param {{
 *   requestBody: Record<string, unknown>,
 *   jobsRoot?: string,
 *   jobId?: string,
 *   now?: string
 * }} input
 */
export function enqueueHomepageGenerationJob({
  requestBody,
  jobsRoot = process.env.HOMEPAGE_JOBS_ROOT || "jobs",
  jobId = createJobId(),
  now = new Date().toISOString(),
} = {}) {
  if (!requestBody || typeof requestBody !== "object" || Array.isArray(requestBody)) {
    throw Object.assign(new Error("requestBody must be an object"), { code: "INVALID_REQUEST_BODY" });
  }
  assertSafeJobId(jobId);
  const safeJobsRoot = resolveHomepageJobsRoot(jobsRoot);
  ensureQueueDirs(safeJobsRoot);
  assertJobDoesNotExist(safeJobsRoot, jobId);
  validateRequestBody(requestBody);

  const pendingPath = path.join(safeJobsRoot, "pending", `${jobId}.json`);
  const tempPath = path.join(
    safeJobsRoot,
    "pending",
    `.${jobId}.${process.pid}.${crypto.randomBytes(4).toString("hex")}.tmp`,
  );

  try {
    fs.writeFileSync(tempPath, JSON.stringify(requestBody, null, 2));
    fs.renameSync(tempPath, pendingPath);
  } catch (error) {
    fs.rmSync(tempPath, { force: true });
    throw error;
  }

  const requestId = String(requestBody.request_id || "");
  const companyId = String(requestBody.company_id || "");
  return buildJobResponse({
    jobId,
    requestId,
    companyId,
    status: "queued",
    queueState: "pending",
    requestPath: pendingPath,
    generatedPath: companyId && isSafeCompanyId(companyId) ? path.join("generated-sites", companyId) : "",
    provider: queuedWorkerProvider,
    queuedAt: now,
  });
}

/**
 * @param {{ jobsRoot?: string, jobId: string }} input
 */
export function synthesizeHomepageGenerationJobStatus({
  jobsRoot = process.env.HOMEPAGE_JOBS_ROOT || "jobs",
  jobId,
} = {}) {
  assertSafeJobId(jobId);
  const safeJobsRoot = resolveHomepageJobsRoot(jobsRoot);
  ensureQueueDirs(safeJobsRoot);

  const located = findQueueJob(safeJobsRoot, jobId);
  if (!located) return null;

  const request = readJson(located.path);
  const requestId = String(request?.request_id || "");
  const companyId = String(request?.company_id || "");
  const generatedPath = companyId && isSafeCompanyId(companyId) ? path.join("generated-sites", companyId) : "";
  const generationResult = generatedPath ? readJsonIfExists(path.join(generatedPath, "generation-result.json")) : null;
  const agentRunReportPath = generatedPath ? path.join(generatedPath, "agent-run-report.json") : "";
  const agentRunReport = agentRunReportPath ? readJsonIfExists(agentRunReportPath) : null;
  const jobReportPath = `${located.path}.job-report.json`;
  const jobReport = readJsonIfExists(jobReportPath);
  const status = synthesizePublicStatus(located.state, generationResult);
  const previewAvailable =
    located.state === "completed" &&
    (status === "generated" || status === "published") &&
    generationResult?.validation_result?.passed === true &&
    generationResult?.build_result?.passed === true;
  const staleHint = buildStalePendingHint(located);

  return buildJobResponse({
    job_id: jobId,
    jobId,
    requestId,
    companyId,
    status,
    queueState: located.state,
    requestPath: located.path,
    generatedPath,
    previewAvailable,
    provider: generationResult?.model_provider || (located.state === "pending" ? queuedWorkerProvider : null),
    validationResult: generationResult?.validation_result || jobReportToValidationResult(jobReport),
    buildResult: generationResult?.build_result || jobReportToBuildResult(jobReport),
    agentRunReportPath: fs.existsSync(agentRunReportPath) ? agentRunReportPath : "",
    jobReportPath: fs.existsSync(jobReportPath) ? jobReportPath : "",
    retryCount: generationResult?.retry_count ?? agentRunReport?.retry_count ?? null,
    customerMessage: staleHint.customerMessage,
    workerHint: staleHint.workerHint,
  });
}

export function normalizeLegacyHomepageGenerationJobStatus({ jobId, job, jobPath } = {}) {
  assertSafeJobId(jobId);
  const result = job?.result && typeof job.result === "object" ? job.result : null;
  const status = typeof job?.status === "string" ? job.status : "failed";
  const companyId = String(job?.company_id || "");
  const generatedPath = String(job?.generated_path || (companyId ? path.join("generated-sites", companyId) : ""));
  const previewAvailable =
    (status === "generated" || status === "published") &&
    result?.validation_result?.passed === true &&
    result?.build_result?.passed === true;
  const agentRunReportPath = companyId ? path.join("generated-sites", companyId, "agent-run-report.json") : "";

  return buildJobResponse({
    jobId: String(job?.job_id || jobId),
    requestId: String(job?.request_id || ""),
    companyId,
    status,
    queueState: "legacy",
    requestPath: String(job?.request_path || jobPath || ""),
    generatedPath,
    previewAvailable,
    provider: result?.model_provider || null,
    validationResult: result?.validation_result || null,
    buildResult: result?.build_result || null,
    agentRunReportPath: fs.existsSync(agentRunReportPath) ? agentRunReportPath : "",
    jobReportPath: "",
    retryCount: result?.retry_count ?? null,
  });
}

export function assertAllowedJobsRoot(rawJobsRoot) {
  const absoluteJobsRoot = path.resolve(rawJobsRoot);
  const allowedRoots = [path.resolve("jobs"), path.resolve("harness", "tmp")];
  const allowed = allowedRoots.some(
    (root) => absoluteJobsRoot === root || absoluteJobsRoot.startsWith(`${root}${path.sep}`),
  );

  if (!allowed) {
    throw Object.assign(
      new Error(`Refusing to operate on jobs root outside jobs/ or harness/tmp/: ${rawJobsRoot}`),
      { code: "JOB_ROOT_NOT_ALLOWED" },
    );
  }
}

function buildJobResponse({
  jobId,
  requestId,
  companyId,
  status,
  queueState,
  requestPath,
  generatedPath = "",
  previewAvailable = false,
  provider = null,
  validationResult = null,
  buildResult = null,
  agentRunReportPath = "",
  jobReportPath = "",
  retryCount = null,
  queuedAt = null,
  customerMessage = null,
  workerHint: debugWorkerHint = null,
}) {
  const customer = {
    status,
    homepage_url: companyId ? `/homepage/${companyId}` : "",
    preview_available: previewAvailable,
  };
  if (customerMessage) customer.message = customerMessage;

  const debug = {
    queue_state: queueState,
    request_path: requestPath ? displayPath(requestPath) : null,
    generated_path: generatedPath || null,
    provider,
    validation_result: validationResult,
    build_result: buildResult,
    agent_run_report_path: agentRunReportPath ? displayPath(agentRunReportPath) : null,
    job_report_path: jobReportPath ? displayPath(jobReportPath) : null,
    retry_count: retryCount,
  };
  if (queuedAt) debug.queued_at = queuedAt;
  if (debugWorkerHint) debug.worker_hint = debugWorkerHint;

  return {
    ok: true,
    job_id: jobId,
    request_id: requestId,
    company_id: companyId,
    status,
    customer,
    debug,
  };
}

function createJobId() {
  return `JOB_${Date.now()}_${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
}

function ensureQueueDirs(jobsRoot) {
  for (const state of queueStates) {
    fs.mkdirSync(path.join(jobsRoot, state), { recursive: true });
  }
}

function assertSafeJobId(jobId) {
  if (typeof jobId !== "string" || !jobIdPattern.test(jobId)) {
    throw Object.assign(new Error("Unsupported job_id"), { code: "UNSUPPORTED_JOB_ID" });
  }
}

function assertJobDoesNotExist(jobsRoot, jobId) {
  for (const state of queueStates) {
    const candidatePath = path.join(jobsRoot, state, `${jobId}.json`);
    if (fs.existsSync(candidatePath)) {
      throw Object.assign(new Error(`Job already exists: ${candidatePath}`), { code: "JOB_EXISTS" });
    }
  }
}

function validateRequestBody(requestBody) {
  const tempDir = path.join("harness", "tmp", "homepage-job-queue-validation");
  fs.mkdirSync(tempDir, { recursive: true });
  const tempPath = path.join(
    tempDir,
    `request-${process.pid}-${Date.now()}-${crypto.randomBytes(4).toString("hex")}.json`,
  );
  fs.writeFileSync(tempPath, JSON.stringify(requestBody, null, 2));

  const validation = spawnSync(process.execPath, ["scripts/validate-request.mjs", tempPath], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
  fs.rmSync(tempPath, { force: true });

  if (validation.status !== 0) {
    const message = [validation.stdout, validation.stderr].filter(Boolean).join("\n").trim();
    throw Object.assign(new Error(message || "Request validation failed"), {
      code: "REQUEST_VALIDATION_FAILED",
    });
  }
}

function findQueueJob(jobsRoot, jobId) {
  for (const state of lookupOrder) {
    const candidatePath = path.join(jobsRoot, state, `${jobId}.json`);
    if (fs.existsSync(candidatePath)) return { state, path: candidatePath };
  }
  return null;
}

function synthesizePublicStatus(queueState, generationResult) {
  if (queueState === "pending") return "queued";
  if (queueState === "processing") return "running";
  if (queueState === "completed") {
    if (generationResult?.status === "published") return "published";
    return "generated";
  }
  if (queueState === "failed" && generationResult?.status === "manual_required") {
    return "manual_required";
  }
  return "failed";
}

function buildStalePendingHint(located) {
  if (located.state !== "pending") return {};
  const staleAfterMs = readPositiveNumber(process.env.HOMEPAGE_JOB_STALE_MS, defaultStaleAfterMs);
  if (staleAfterMs <= 0) return {};
  const ageMs = getFileAgeMs(located.path);
  if (ageMs < staleAfterMs) return {};
  return {
    customerMessage: staleQueuedMessage,
    workerHint,
  };
}

function getFileAgeMs(filePath) {
  try {
    return Date.now() - fs.statSync(filePath).mtimeMs;
  } catch {
    return 0;
  }
}

function jobReportToValidationResult(jobReport) {
  if (!jobReport || !("validation_passed" in jobReport)) return null;
  return {
    passed: jobReport.validation_passed === true,
    errors: jobReport.validation_passed === false ? [jobReport.error_type || "validation failed"] : [],
    warnings: [],
  };
}

function jobReportToBuildResult(jobReport) {
  if (!jobReport || !("build_passed" in jobReport)) return null;
  return {
    passed: jobReport.build_passed === true,
    command: "npm run build",
    errors: jobReport.build_passed === false ? [jobReport.error_type || "build failed"] : [],
  };
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function readJsonIfExists(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function isSafeCompanyId(companyId) {
  return /^[A-Za-z0-9_-]+$/.test(companyId);
}

function readPositiveNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function displayPath(filePath) {
  const relativePath = path.relative(process.cwd(), path.resolve(filePath));
  return relativePath && !relativePath.startsWith("..") ? relativePath : filePath;
}
