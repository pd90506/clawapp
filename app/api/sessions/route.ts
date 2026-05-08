import { NextResponse } from "next/server";
import { z } from "zod";
import { getClient } from "@/lib/openclaw";

export async function GET() {
  const c = getClient();
  if (!c) return NextResponse.json({ error: "no-config" }, { status: 503 });
  const sessions = await c.listSessions();
  return NextResponse.json({ sessions });
}

const PostBody = z.object({ label: z.string().optional() });

export async function POST(req: Request) {
  const c = getClient();
  if (!c) return NextResponse.json({ error: "no-config" }, { status: 503 });
  const body = await req.json().catch(() => ({}));
  const parsed = PostBody.safeParse(body);
  const label = parsed.success ? parsed.data.label : undefined;
  const summary = await c.createSession({ label });
  return NextResponse.json(summary);
}
