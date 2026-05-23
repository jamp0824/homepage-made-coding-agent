import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const queueStates = ["pending", "processing", "completed", "failed"];
const lookupOrder = ["processing", "pending", "completed", "failed"];
const jobIdPattern = /^[A-Za-z0-9_-]+$/;

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
  return buildQueuedResponse({
    jobId,
    requestId,
    companyId,
    requestPath: pendingPath,
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

  return {
    ok: true,
    job_id: jobId,
    request_id: requestId,
    company_id: companyId,
    status,
    customer: {
      status,
      homepage_url: companyId ? `/homepage/${companyId}` : "",
      preview_available: previewAvailable,
    },
    debug: {
      queue_state: located.state,
      request_path: displayPath(located.path),
      generated_path: generatedPath || null,
      provider: generationResult?.model_provider || (located.state === "pending" ? "queued_worker" : null),
      validation_result: generationResult?.validation_result || jobReportToValidationResult(jobReport),
      build_result: generationResult?.build_result || jobReportToBuildResult(jobReport),
      agent_run_report_path: fs.existsSync(agentRunReportPath) ? displayPath(agentRunReportPath) : null,
      job_report_path: fs.existsSync(jobReportPath) ? displayPath(jobReportPath) : null,
      retry_count: generationResult?.retry_count ?? agentRunReport?.retry_count ?? null,
    },
  };
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

function buildQueuedResponse({ jobId, requestId, companyId, requestPath, queuedAt }) {
  return {
    ok: true,
    job_id: jobId,
    request_id: requestId,
    company_id: companyId,
    status: "queued",
    customer: {
      status: "queued",
      homepage_url: companyId ? `/homepage/${companyId}` : "",
      preview_available: false,
    },
    debug: {
      queue_state: "pending",
      request_path: displayPath(requestPath),
      provider: "queued_worker",
      validation_result: null,
      build_result: null,
      agent_run_report_path: null,
      queued_at: queuedAt,
    },
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

function displayPath(filePath) {
  const relativePath = path.relative(process.cwd(), path.resolve(filePath));
  return relativePath && !relativePath.startsWith("..") ? relativePath : filePath;
}
