import { NextResponse } from "next/server";
import {
  patchHomepageDraft,
  readHomepageDraft,
  type DraftPatch,
} from "../../../../lib/homepage-drafts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ draftId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { draftId } = await context.params;

  try {
    const bundle = readHomepageDraft(draftId);
    if (!bundle) {
      return NextResponse.json({ error: "Draft not found" }, { status: 404 });
    }

    return NextResponse.json({
      ok: bundle.draft.validation_result.passed,
      ...bundle,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Draft read failed" },
      { status: 400 },
    );
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const { draftId } = await context.params;
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  try {
    const bundle = patchHomepageDraft(
      draftId,
      (payload && typeof payload === "object" ? payload : {}) as DraftPatch,
    );
    if (!bundle) {
      return NextResponse.json({ error: "Draft not found" }, { status: 404 });
    }

    return NextResponse.json({
      ok: bundle.draft.validation_result.passed,
      ...bundle,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Draft patch failed" },
      { status: 400 },
    );
  }
}
