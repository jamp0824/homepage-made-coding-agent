import { NextResponse } from "next/server";
import { getJobQueueSummary } from "../../../lib/jobs";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(getJobQueueSummary());
}
