import { NextResponse } from "next/server";
import { getClient } from "@/lib/openclaw";

// "/new" — mint a fresh app-session chain member for this agent and return it
// (the new active session). Prior members stay listed and are stitched above the
// divider by GET .../thread.
export async function POST(_req: Request, ctx: { params: Promise<{ agent: string }> }) {
  const c = getClient();
  if (!c) return NextResponse.json({ error: "no-config" }, { status: 503 });
  const { agent } = await ctx.params;
  const summary = await c.createAgentSession(agent);
  return NextResponse.json(summary);
}
