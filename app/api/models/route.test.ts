import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("@/lib/openclaw", () => ({ getClient: vi.fn() }));
import { getClient } from "@/lib/openclaw";
import { GET } from "./route";

beforeEach(() => vi.mocked(getClient).mockReset());

describe("GET /api/models", () => {
  it("returns 503 when no client", async () => {
    vi.mocked(getClient).mockReturnValue(null);
    const r = await GET();
    expect(r.status).toBe(503);
  });
  it("returns models on success", async () => {
    vi.mocked(getClient).mockReturnValue({
      listModels: async () => [{ id: "kimi/kimi-code", label: "Kimi", isDefault: true }],
    } as never);
    const r = await GET();
    expect(await r.json()).toEqual({ models: [{ id: "kimi/kimi-code", label: "Kimi", isDefault: true }] });
  });
  it("returns 200 + empty models on error (graceful)", async () => {
    vi.mocked(getClient).mockReturnValue({
      listModels: async () => { throw new Error("boom"); },
    } as never);
    const r = await GET();
    expect(r.status).toBe(200);
    const j = await r.json();
    expect(j.models).toEqual([]);
  });
});
