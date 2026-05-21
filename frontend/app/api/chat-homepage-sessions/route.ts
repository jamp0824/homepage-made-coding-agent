import { NextResponse } from "next/server";
import { buildPreviewState, createChatHomepageSession } from "../../../lib/chat-homepage-sessions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  let payload: unknown = {};

  try {
    const text = await request.text();
    payload = text ? JSON.parse(text) : {};
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  try {
    const session = createChatHomepageSession(payload);
    return NextResponse.json({
      ok: true,
      session_id: session.session_id,
      status: session.status,
      session,
      preview_state: buildPreviewState(session),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Chat session creation failed" },
      { status: 400 },
    );
  }
}
