import { NextResponse } from "next/server";
import { z } from "zod";
import { getClient } from "@/lib/openclaw";

const Body = z.object({ agentId: z.string().min(1) });

// Resolve an agent to its single app-owned session (`app:<agent>`), creating it
// on first open. The sidebar calls this on select so chats stay one-per-agent and
// never piggyback on another surface's (e.g. Telegram) transcript.
export async function POST(req: Request) {
  const c = getClient();
  if (!c) return NextResponse.json({ error: "no-config" }, { status: 503 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "bad-body" }, { status: 400 });
  const summary = await c.resolveAgentSession(parsed.data.agentId);
  return NextResponse.json(summary);
}
