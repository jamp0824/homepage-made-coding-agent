import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ jobId: string }>;
};

const jobRoot = path.join(process.cwd(), "harness", "tmp", "homepage-generation-jobs");
const jobIdPattern = /^[A-Za-z0-9_-]+$/;

export async function GET(_request: Request, context: RouteContext) {
  const { jobId } = await context.params;
  if (!jobIdPattern.test(jobId)) {
    return NextResponse.json({ error: "Unsupported job_id" }, { status: 400 });
  }

  const jobPath = path.join(jobRoot, `${jobId}.json`);
  if (!fs.existsSync(jobPath)) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  try {
    const job = JSON.parse(fs.readFileSync(jobPath, "utf8"));
    return NextResponse.json({ ok: true, job });
  } catch {
    return NextResponse.json({ error: "Job JSON could not be read" }, { status: 500 });
  }
}
