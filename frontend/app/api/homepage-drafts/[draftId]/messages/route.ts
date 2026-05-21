import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { NextResponse } from "next/server";
import {
  applyDraftMessage,
  extractAllowedDraftPatch,
  readHomepageDraft,
  type DraftPatch,
  type HomepageDraft,
} from "../../../../../lib/homepage-drafts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ draftId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const { draftId } = await context.params;
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const message =
    payload && typeof payload === "object" && "message" in payload
      ? String((payload as { message?: unknown }).message || "").trim()
      : "";

  if (!message) {
    return NextResponse.json({ error: "message is required" }, { status: 400 });
  }

  try {
    const bundle = readHomepageDraft(draftId);
    if (!bundle) {
      return NextResponse.json({ error: "Draft not found" }, { status: 404 });
    }

    const gooseResult = maybeRunGooseDraftEdit({ draftId, draft: bundle.draft, message });
    const result = applyDraftMessage(draftId, message, gooseResult.patch);
    if (!result) {
      return NextResponse.json({ error: "Draft not found" }, { status: 404 });
    }

    return NextResponse.json({
      ok: result.draft.validation_result.passed,
      assistant_message: result.assistantMessage,
      patch: result.patch,
      draft_provider: gooseResult.provider,
      draft_provider_status: gooseResult.status,
      draft: result.draft,
      session: result.session,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Draft message failed" },
      { status: 400 },
    );
  }
}

function maybeRunGooseDraftEdit({
  draft,
  draftId,
  message,
}: {
  draft: HomepageDraft;
  draftId: string;
  message: string;
}): { provider: string; status: string; patch: DraftPatch } {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), `${draftId}-`));
  const tempDraftPath = path.join(tempDir, "content.draft.json");

  try {
    fs.writeFileSync(tempDraftPath, JSON.stringify(draft, null, 2));
    const result = spawnSync("bash", ["scripts/run-goose-homepage-draft-recipe.sh", tempDraftPath, message], {
      cwd: process.cwd(),
      env: {
        ...buildChildEnv(),
        GOOSE_MAX_TURNS_FOR_DRAFT: "6",
      },
      encoding: "utf8",
      timeout: 1000 * 45,
    });

    if (result.status !== 0) {
      return { provider: "deterministic_fallback", status: "goose_unavailable_or_failed", patch: {} };
    }

    const candidate = JSON.parse(fs.readFileSync(tempDraftPath, "utf8")) as HomepageDraft;
    return {
      provider: "goose_edit_agent",
      status: "completed",
      patch: extractAllowedDraftPatch(draft, candidate),
    };
  } catch {
    return { provider: "deterministic_fallback", status: "goose_unavailable_or_failed", patch: {} };
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
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
