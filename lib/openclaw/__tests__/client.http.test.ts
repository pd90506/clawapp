import { describe, it, expect, vi, beforeEach } from "vitest";
import { createClient } from "../client";

const cfg = { url: "http://127.0.0.1:18789", token: "tok", source: "file" as const };

beforeEach(() => { vi.restoreAllMocks(); });

describe("client http", () => {
  it("listSessions sends bearer token", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ sessions: [{ id: "s1", title: "hello" }] }), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);
    const c = createClient(cfg);
    const out = await c.listSessions();
    expect(out).toEqual([{ id: "s1", title: "hello" }]);
    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers.Authorization).toBe("Bearer tok");
  });

  it("getHistory returns parsed messages", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ messages: [{ role: "user", text: "hi", at: 1 }] }), { status: 200 })
    ));
    const c = createClient(cfg);
    const msgs = await c.getHistory("s1");
    expect(msgs).toEqual([{ role: "user", text: "hi", at: 1 }]);
  });

  it("health returns ok:true on 200", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("ok", { status: 200 })));
    const c = createClient(cfg);
    expect(await c.health()).toEqual({ ok: true });
  });

  it("health returns ok:false on network error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")));
    const c = createClient(cfg);
    expect(await c.health()).toEqual({ ok: false, reason: "ECONNREFUSED" });
  });
});
