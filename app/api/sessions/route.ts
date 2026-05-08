import { NextResponse } from "next/server";
import { getClient } from "@/lib/openclaw";

export async function GET() {
  const c = getClient();
  if (!c) return NextResponse.json({ error: "no-config" }, { status: 503 });
  const sessions = await c.listSessions();
  return NextResponse.json({ sessions });
}
