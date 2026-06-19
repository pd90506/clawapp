import { NextResponse } from "next/server";
import { getClient } from "@/lib/openclaw";

// Available slash commands (incl. skills) for an agent — powers the composer's
// "/" autocomplete. `?agent=<id>` scopes to that agent; omit for the default.
export async function GET(req: Request) {
  const c = getClient();
  if (!c) return NextResponse.json({ error: "no-config" }, { status: 503 });
  const agent = new URL(req.url).searchParams.get("agent") ?? undefined;
  try {
    const commands = await c.listCommands(agent);
    return NextResponse.json({ commands });
  } catch {
    return NextResponse.json({ commands: [] });
  }
}
