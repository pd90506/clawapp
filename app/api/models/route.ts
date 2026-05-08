import { NextResponse } from "next/server";
import { getClient } from "@/lib/openclaw";

export async function GET() {
  const c = getClient();
  if (!c) return NextResponse.json({ error: "no-config" }, { status: 503 });
  try {
    const models = await c.listModels();
    return NextResponse.json({ models });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message, models: [] }, { status: 200 });
  }
}
