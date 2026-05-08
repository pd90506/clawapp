import { NextResponse } from "next/server";
import { getClient } from "@/lib/openclaw";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const c = getClient();
  if (!c) return NextResponse.json({ error: "no-config" }, { status: 503 });
  const { id } = await ctx.params;
  const messages = await c.getHistory(id);
  return NextResponse.json({ messages });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const c = getClient();
  if (!c) return NextResponse.json({ error: "no-config" }, { status: 503 });
  const { id } = await ctx.params;
  await c.deleteSession(id);
  return NextResponse.json({ ok: true });
}
