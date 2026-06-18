import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/openclaw", () => ({ getClient: vi.fn() }));
import { getClient } from "@/lib/openclaw";
import { POST } from "./route";

beforeEach(() => vi.mocked(getClient).mockReset());

const post = (body: unknown) =>
  POST(new Request("http://x", { method: "POST", body: JSON.stringify(body) }));

describe("POST /api/sessions/resolve", () => {
  it("returns 503 with no config", async () => {
    vi.mocked(getClient).mockReturnValue(null);
    expect((await post({ agentId: "main" })).status).toBe(503);
  });

  it("returns 400 when agentId missing", async () => {
    vi.mocked(getClient).mockReturnValue({ resolveAgentSession: vi.fn() } as never);
    expect((await post({})).status).toBe(400);
  });

  it("resolves the agent's app-owned session", async () => {
    const resolveAgentSession = vi.fn(async () => ({ id: "app:silver-wolf", title: "silver-wolf" }));
    vi.mocked(getClient).mockReturnValue({ resolveAgentSession } as never);
    const r = await post({ agentId: "silver-wolf" });
    expect(await r.json()).toEqual({ id: "app:silver-wolf", title: "silver-wolf" });
    expect(resolveAgentSession).toHaveBeenCalledWith("silver-wolf");
  });
});
