import { NextResponse } from "next/server";
import { generateChatHomepageSession } from "../../../../../lib/chat-homepage-sessions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ sessionId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const { sessionId } = await context.params;
  let payload: unknown = {};

  try {
    const text = await request.text();
    payload = text ? JSON.parse(text) : {};
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const generationMode =
    payload && typeof payload === "object" && "generation_mode" in payload
      ? (payload as { generation_mode?: unknown }).generation_mode
      : undefined;

  try {
    const result = generateChatHomepageSession(sessionId, generationMode);
    if (!result) {
      return NextResponse.json({ error: "Chat session not found" }, { status: 404 });
    }
    const ok = result.session.status === "generated";
    return NextResponse.json({
      ok,
      session_id: result.session.session_id,
      status: result.session.status,
      request: result.request,
      job: result.job,
      session: result.session,
      stdout: result.stdout,
      stderr: result.stderr,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Chat generation failed" },
      { status: 400 },
    );
  }
}
