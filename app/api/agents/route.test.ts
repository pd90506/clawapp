import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/openclaw", () => ({ getClient: vi.fn() }));
import { getClient } from "@/lib/openclaw";
import { GET } from "./route";

beforeEach(() => vi.mocked(getClient).mockReset());

describe("GET /api/agents", () => {
  it("returns 503 when no client", async () => {
    vi.mocked(getClient).mockReturnValue(null);
    const r = await GET();
    expect(r.status).toBe(503);
  });
  it("returns agents array on success", async () => {
    vi.mocked(getClient).mockReturnValue({
      listAgents: async () => [{ id: "main", label: "Main", model: "kimi/kimi-code" }],
    } as never);
    const r = await GET();
    expect(await r.json()).toEqual({ agents: [{ id: "main", label: "Main", model: "kimi/kimi-code" }] });
  });
});
