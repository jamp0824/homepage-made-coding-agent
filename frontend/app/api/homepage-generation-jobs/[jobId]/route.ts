import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { synthesizeHomepageGenerationJobStatus } from "../../../../../scripts/lib/homepage-job-queue.mjs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ jobId: string }>;
};

const legacyJobRoot = path.join(process.cwd(), "harness", "tmp", "homepage-generation-jobs");
const jobIdPattern = /^[A-Za-z0-9_-]+$/;

export async function GET(_request: Request, context: RouteContext) {
  const { jobId } = await context.params;
  if (!jobIdPattern.test(jobId)) {
    return NextResponse.json({ error: "Unsupported job_id" }, { status: 400 });
  }

  try {
    const queueStatus = synthesizeHomepageGenerationJobStatus({ jobId });
    if (queueStatus) return NextResponse.json(queueStatus);

    const legacyStatus = readLegacyJob(jobId);
    if (legacyStatus) return NextResponse.json(legacyStatus);

    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Job status could not be read" },
      { status: 500 },
    );
  }
}

function readLegacyJob(jobId: string) {
  const jobPath = path.join(legacyJobRoot, `${jobId}.json`);
  if (!fs.existsSync(jobPath)) return null;

  const job = JSON.parse(fs.readFileSync(jobPath, "utf8"));
  const result = job.result && typeof job.result === "object" ? job.result : null;
  const status = typeof job.status === "string" ? job.status : "failed";
  const previewAvailable =
    (status === "generated" || status === "published") &&
    result?.validation_result?.passed === true &&
    result?.build_result?.passed === true;

  return {
    ok: true,
    job_id: job.job_id || jobId,
    request_id: job.request_id || "",
    company_id: job.company_id || "",
    status,
    customer: {
      status,
      homepage_url: job.homepage_url || (job.company_id ? `/homepage/${job.company_id}` : ""),
      preview_available: previewAvailable,
    },
    debug: {
      queue_state: "legacy",
      request_path: job.request_path || jobPath,
      generated_path: job.generated_path || null,
      provider: result?.model_provider || null,
      validation_result: result?.validation_result || null,
      build_result: result?.build_result || null,
      agent_run_report_path: job.company_id
        ? path.join("generated-sites", String(job.company_id), "agent-run-report.json")
        : null,
      job_report_path: null,
      retry_count: result?.retry_count ?? null,
    },
  };
}
