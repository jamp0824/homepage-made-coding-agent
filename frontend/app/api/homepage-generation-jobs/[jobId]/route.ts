import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import {
  normalizeLegacyHomepageGenerationJobStatus,
  synthesizeHomepageGenerationJobStatus,
} from "../../../../../scripts/lib/homepage-job-queue.mjs";

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
  return normalizeLegacyHomepageGenerationJobStatus({ jobId, job, jobPath });
}
