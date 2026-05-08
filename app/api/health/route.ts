import { NextResponse } from "next/server";
import { getClient } from "@/lib/openclaw";

export async function GET() {
  const c = getClient();
  if (!c) return NextResponse.json({ ok: false, reason: "no-config" }, { status: 503 });
  const r = await c.health();
  return NextResponse.json(r, { status: r.ok ? 200 : 503 });
}
