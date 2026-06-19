import { NextResponse } from "next/server";
import { getClient } from "@/lib/openclaw";

// The agent's full app thread: every chain member's transcript stitched
// oldest→newest with "New session started" dividers, plus the active session id
// (where new turns are sent). See client.getAgentThread.
export async function GET(_req: Request, ctx: { params: Promise<{ agent: string }> }) {
  const c = getClient();
  if (!c) return NextResponse.json({ error: "no-config" }, { status: 503 });
  const { agent } = await ctx.params;
  const thread = await c.getAgentThread(agent);
  return NextResponse.json(thread);
}
