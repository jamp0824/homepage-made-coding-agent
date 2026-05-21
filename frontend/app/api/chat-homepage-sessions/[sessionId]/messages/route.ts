import { NextResponse } from "next/server";
import { applyChatHomepageMessage } from "../../../../../lib/chat-homepage-sessions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ sessionId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const { sessionId } = await context.params;
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
    const result = applyChatHomepageMessage(sessionId, message);
    if (!result) {
      return NextResponse.json({ error: "Chat session not found" }, { status: 404 });
    }
    return NextResponse.json({
      ok: true,
      session_id: result.session.session_id,
      status: result.session.status,
      assistant_message: result.action.assistant_message,
      action: result.action,
      request_patch: result.action.request_patch || {},
      content_draft_patch: result.action.content_draft_patch || {},
      session: result.session,
      preview_state: result.preview_state,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Chat message failed" },
      { status: 400 },
    );
  }
}
