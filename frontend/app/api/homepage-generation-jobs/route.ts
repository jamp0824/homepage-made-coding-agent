import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { NextResponse } from "next/server";
import {
  buildConfirmedRequestFromDraft,
  confirmDraft,
  readHomepageDraft,
} from "../../../lib/homepage-drafts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type GenerationJob = {
  job_id: string;
  request_id: string;
  company_id: string;
  status: "running" | "generated" | "published" | "manual_required" | "failed";
  request_path: string;
  generated_path: string;
  homepage_url: string;
  exit_code: number | null;
  generation_mode: "local" | "auto" | "required";
  created_at: string;
  updated_at: string;
  result?: unknown;
};

const jobRoot = path.join(process.cwd(), "harness", "tmp", "homepage-generation-jobs");
const requestRoot = path.join(process.cwd(), "harness", "tmp", "homepage-generation-requests");

export async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  try {
    const body = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
    const requestBody = resolveRequestBody(body);
    const generationMode = normalizeGenerationMode(body.generation_mode);
    const jobId = `JOB_${Date.now()}`;
    const requestPath = writeRequest(jobId, requestBody);
    const sitePath = path.join("generated-sites", String(requestBody.company_id));
    const now = new Date().toISOString();
    const job: GenerationJob = {
      job_id: jobId,
      request_id: String(requestBody.request_id),
      company_id: String(requestBody.company_id),
      status: "running",
      request_path: requestPath,
      generated_path: sitePath,
      homepage_url: `/homepage/${requestBody.company_id}`,
      exit_code: null,
      generation_mode: generationMode,
      created_at: now,
      updated_at: now,
    };
    writeJob(job);

    const result = spawnSync("bash", ["scripts/run-homepage-builder.sh", requestPath], {
      cwd: process.cwd(),
      env: {
        ...buildChildEnv(),
        GOOSE_MODE: generationMode,
        MAX_RETRY: generationMode === "required" ? "3" : "1",
        NEXT_BUILD_TIMEOUT_MS: "120000",
      },
      encoding: "utf8",
      timeout: 1000 * 60 * 6,
    });
    const generationResult = readGenerationResult(String(requestBody.company_id));
    const status = normalizeJobStatus(generationResult, result.status);
    const completedJob: GenerationJob = {
      ...job,
      status,
      exit_code: result.status,
      updated_at: new Date().toISOString(),
      result: generationResult,
    };
    writeJob(completedJob);

    return NextResponse.json({
      ok: status === "generated" || status === "published",
      job: completedJob,
      stdout: scrubLog(result.stdout || ""),
      stderr: scrubLog(result.stderr || ""),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Generation job failed" },
      { status: 400 },
    );
  }
}

function resolveRequestBody(body: Record<string, unknown>) {
  const draftId = typeof body.draft_id === "string" ? body.draft_id : "";
  if (draftId) {
    const bundle = readHomepageDraft(draftId);
    if (!bundle) throw new Error("Draft not found");
    if (!bundle.draft.validation_result.passed) {
      throw new Error("Draft validation must pass before generation");
    }
    confirmDraft(draftId);
    return buildConfirmedRequestFromDraft(bundle.draft) as Record<string, unknown>;
  }

  const rawRequest =
    body.request && typeof body.request === "object" && !Array.isArray(body.request)
      ? (body.request as Record<string, unknown>)
      : body;
  for (const field of [
    "request_id",
    "company_id",
    "homepage_type",
    "company_name",
    "industry",
    "business_type",
    "main_business_description",
  ]) {
    if (typeof rawRequest[field] !== "string" || String(rawRequest[field]).trim() === "") {
      throw new Error(`Missing required request field: ${field}`);
    }
  }
  return rawRequest;
}

function writeRequest(jobId: string, requestBody: Record<string, unknown>) {
  fs.mkdirSync(requestRoot, { recursive: true });
  const requestPath = path.join(requestRoot, `${jobId}.json`);
  fs.writeFileSync(requestPath, JSON.stringify(requestBody, null, 2));
  return requestPath;
}

function writeJob(job: GenerationJob) {
  fs.mkdirSync(jobRoot, { recursive: true });
  fs.writeFileSync(path.join(jobRoot, `${job.job_id}.json`), JSON.stringify(job, null, 2));
}

function readGenerationResult(companyId: string) {
  const resultPath = path.join(process.cwd(), "generated-sites", companyId, "generation-result.json");
  try {
    return JSON.parse(fs.readFileSync(resultPath, "utf8"));
  } catch {
    return null;
  }
}

function normalizeJobStatus(generationResult: any, exitCode: number | null): GenerationJob["status"] {
  if (generationResult?.status === "generated" || generationResult?.status === "published") {
    return generationResult.status;
  }
  if (generationResult?.status === "manual_required") return "manual_required";
  return exitCode === 0 ? "generated" : "failed";
}

function normalizeGenerationMode(value: unknown): GenerationJob["generation_mode"] {
  if (value === "required" || value === "goose") return "required";
  if (value === "auto") return "auto";
  return "local";
}

function buildChildEnv() {
  const env = { ...process.env };
  for (const key of Object.keys(env)) {
    if (key.startsWith("NEXT_") || key.startsWith("__NEXT_")) {
      delete env[key];
    }
  }
  return env;
}

function scrubLog(value: string) {
  return value
    .split("\n")
    .filter((line) => !/api[_-]?key|oauth|token|secret/i.test(line))
    .slice(-40)
    .join("\n");
}
