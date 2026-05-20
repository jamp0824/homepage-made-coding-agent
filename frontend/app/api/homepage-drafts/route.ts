import { spawnSync } from "node:child_process";
import { NextResponse } from "next/server";
import {
  createHomepageDraft,
  readHomepageDraft,
  refreshHomepageDraftValidation,
  saveHomepageDraftBundle,
  type DraftCreatePayload,
} from "../../../lib/homepage-drafts";

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
    const body = (payload && typeof payload === "object" ? payload : {}) as DraftCreatePayload & {
      draft_mode?: string;
    };
    const created = createHomepageDraft(
      (payload && typeof payload === "object" ? payload : {}) as DraftCreatePayload,
    );
    const gooseResult = maybeRunGooseDraft({
      draftId: created.draft.draft_id,
      draftMode: body.draft_mode,
      userMessage: body.initial_prompt || body.initialPrompt || "",
    });
    let bundle =
      refreshHomepageDraftValidation(created.draft.draft_id) ||
      readHomepageDraft(created.draft.draft_id) ||
      created;
    if (
      gooseResult.provider === "goose_draft_agent" &&
      gooseResult.status === "completed" &&
      !bundle.draft.validation_result.passed &&
      body.draft_mode !== "required" &&
      body.draft_mode !== "goose"
    ) {
      saveHomepageDraftBundle(created.draft, created.session);
      bundle = created;
      gooseResult.provider = "deterministic_fallback";
      gooseResult.status = "goose_invalid_draft_fallback";
    }
    const { draft, session } = bundle;

    return NextResponse.json({
      ok: draft.validation_result.passed,
      draft_id: draft.draft_id,
      assistant_message: session.last_assistant_message,
      draft_provider: gooseResult.provider,
      draft_provider_status: gooseResult.status,
      draft,
      session,
      preview_model: buildPreviewModel(draft),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Draft creation failed" },
      { status: 500 },
    );
  }
}

function buildPreviewModel(draft: ReturnType<typeof createHomepageDraft>["draft"]) {
  return {
    template_id: draft.homepage_type === "company_intro" ? "company_intro_basic" : "product_basic",
    template_variant: draft.homepage_type === "company_intro" ? "result_style_v1" : "basic",
    editable_slots: Object.keys(draft.section_visibility),
    section_visibility: draft.section_visibility,
    section_layout: draft.section_layout,
    content_density: draft.content_density,
  };
}

function maybeRunGooseDraft({
  draftId,
  draftMode,
  userMessage,
}: {
  draftId: string;
  draftMode?: string;
  userMessage: string;
}) {
  const mode = draftMode === "required" || draftMode === "goose" ? "required" : draftMode === "local" ? "local" : "auto";
  if (mode === "local") {
    return { provider: "deterministic_fallback", status: "skipped" };
  }

  const draftPath = `harness/tmp/homepage-drafts/${draftId}/content.draft.json`;
  const result = spawnSync("bash", ["scripts/run-goose-homepage-draft-recipe.sh", draftPath, userMessage], {
    cwd: process.cwd(),
    env: {
      ...buildChildEnv(),
      GOOSE_MAX_TURNS_FOR_DRAFT: "8",
    },
    encoding: "utf8",
    timeout: 1000 * 60 * 2,
  });

  if (result.status === 0) {
    return { provider: "goose_draft_agent", status: "completed" };
  }
  if (mode === "required") {
    throw new Error(scrubLog(result.stderr || result.stdout || "Goose draft agent failed"));
  }
  return { provider: "deterministic_fallback", status: "goose_unavailable_or_failed" };
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
    .slice(-8)
    .join("\n");
}
