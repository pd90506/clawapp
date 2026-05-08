import { NextResponse } from "next/server";
import { getClient } from "@/lib/openclaw";
import { loadDefaultModelId } from "@/lib/openclaw/config";

/**
 * Returns the model catalog from openclaw, with `isDefault` flagged using
 * `agents.defaults.model.primary` from the local config when openclaw's
 * payload doesn't already designate one. Match is case-insensitive on
 * either the bare id ("kimi-code") or the qualified id ("kimi/kimi-code"
 * = "<provider>/<id>").
 */
export async function GET() {
  const c = getClient();
  if (!c) return NextResponse.json({ error: "no-config" }, { status: 503 });
  try {
    const models = await c.listModels();
    const anyFlagged = models.some((m) => m.isDefault);
    if (!anyFlagged) {
      const primary = loadDefaultModelId();
      if (primary) {
        const target = primary.toLowerCase();
        const adjusted = models.map((m) => {
          const qualified = m.provider ? `${m.provider}/${m.id}`.toLowerCase() : m.id.toLowerCase();
          return { ...m, isDefault: qualified === target || m.id.toLowerCase() === target };
        });
        return NextResponse.json({ models: adjusted });
      }
    }
    return NextResponse.json({ models });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message, models: [] }, { status: 200 });
  }
}
