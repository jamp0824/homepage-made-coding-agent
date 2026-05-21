import { NextResponse } from "next/server";
import { buildPreviewState, readChatHomepageSession } from "../../../../lib/chat-homepage-sessions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ sessionId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { sessionId } = await context.params;

  try {
    const session = readChatHomepageSession(sessionId);
    if (!session) {
      return NextResponse.json({ error: "Chat session not found" }, { status: 404 });
    }
    return NextResponse.json({
      ok: true,
      session_id: session.session_id,
      status: session.status,
      session,
      preview_state: buildPreviewState(session),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Chat session read failed" },
      { status: 400 },
    );
  }
}
