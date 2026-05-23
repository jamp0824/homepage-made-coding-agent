import { NextResponse } from "next/server";
import {
  buildConfirmedRequestFromDraft,
  confirmDraft,
  readHomepageDraft,
} from "../../../lib/homepage-drafts";
import { enqueueHomepageGenerationJob } from "../../../../scripts/lib/homepage-job-queue.mjs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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
    const queued = enqueueHomepageGenerationJob({ requestBody });

    return NextResponse.json(queued, { status: 202 });
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
  return removeTransportFields(rawRequest);
}

function removeTransportFields(rawRequest: Record<string, unknown>) {
  const { draft_id: _draftId, generation_mode: _generationMode, ...requestBody } = rawRequest;
  return requestBody;
}
