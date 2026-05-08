import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/openclaw", () => ({ getClient: vi.fn() }));
import { getClient } from "@/lib/openclaw";
import { GET } from "./route";

beforeEach(() => vi.mocked(getClient).mockReset());

describe("GET /api/health", () => {
  it("returns 503 when no client configured", async () => {
    vi.mocked(getClient).mockReturnValue(null);
    const res = await GET();
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ ok: false, reason: "no-config" });
  });
  it("returns ok:true when gateway healthy", async () => {
    vi.mocked(getClient).mockReturnValue({ health: async () => ({ ok: true }) } as never);
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
  it("returns ok:false reason when gateway down", async () => {
    vi.mocked(getClient).mockReturnValue({ health: async () => ({ ok: false, reason: "ECONNREFUSED" }) } as never);
    const res = await GET();
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ ok: false, reason: "ECONNREFUSED" });
  });
});
