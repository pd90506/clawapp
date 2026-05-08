// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { startFakeGateway, type FakeGateway, type FakeClient } from "./fakeGateway";
import { GatewayConnection } from "../connection";
import { createClient } from "../client";

let gw: FakeGateway;
let server: FakeClient;

beforeEach(async () => {
  gw = await startFakeGateway();
  gw.onClient((c) => {
    server = c;
    c.onRequest(async (method, params) => {
      switch (method) {
        case "sessions.list":
          return { ok: true, payload: { sessions: [
            { key: "main", displayName: "Main session", hasActiveRun: false },
            { key: "test", label: "test-label" },
          ]}};
        case "chat.history":
          return { ok: true, payload: { messages: [
            { role: "user", content: "hi", timestamp: 1000 },
            { role: "assistant", content: [{ type: "text", text: "hello" }], timestamp: 1010 },
          ]}};
        case "health":
          return { ok: true, payload: { ok: true } };
        case "sessions.messages.subscribe":
        case "sessions.subscribe":
          return { ok: true, payload: { subscribed: true, key: (params as { key: string }).key } };
        case "sessions.messages.unsubscribe":
        case "sessions.unsubscribe":
          return { ok: true, payload: { subscribed: false, key: (params as { key: string }).key } };
        case "chat.send": {
          // Sanity: must include `message` and `idempotencyKey` in params
          const p = params as { sessionKey?: string; message?: string; idempotencyKey?: string };
          if (!p.message || !p.idempotencyKey) return { ok: false, error: { message: "missing required fields" } };
          return { ok: true, payload: { runId: "r1", status: "started" } };
        }
        case "chat.abort":
          return { ok: true, payload: { ok: true, aborted: true, runIds: ["r1"] } };
        default: return { ok: false, error: { message: "no" } };
      }
    });
  });
});
afterEach(async () => { await gw.close(); });

describe("createClient", () => {
  it("listSessions maps key/displayName to id/title", async () => {
    const conn = GatewayConnection.fromConfig({ url: gw.httpUrl, token: "t", source: "file" });
    await conn.ready();
    const c = createClient(conn);
    const s = await c.listSessions();
    expect(s).toEqual([
      { id: "main", title: "Main session" },
      { id: "test", title: "test-label" },
    ]);
    await conn.close();
  });

  it("getHistory normalizes content/timestamp shape", async () => {
    const conn = GatewayConnection.fromConfig({ url: gw.httpUrl, token: "t", source: "file" });
    await conn.ready();
    const c = createClient(conn);
    const m = await c.getHistory("main");
    expect(m).toEqual([
      { role: "user", text: "hi", at: 1000 },
      { role: "assistant", text: "hello", at: 1010 },
    ]);
    await conn.close();
  });

  it("health returns ok:true on success", async () => {
    const conn = GatewayConnection.fromConfig({ url: gw.httpUrl, token: "t", source: "file" });
    await conn.ready();
    const c = createClient(conn);
    expect(await c.health()).toEqual({ ok: true });
    await conn.close();
  });

  it("sendMessage streams adapted events and ends on done", async () => {
    const conn = GatewayConnection.fromConfig({ url: gw.httpUrl, token: "t", source: "file" });
    await conn.ready();
    const c = createClient(conn);

    // After client subscribes, simulate the gateway pushing chat events for runId r1
    queueMicrotask(() => setTimeout(() => {
      server.emitEvent("chat", { runId: "r1", sessionKey: "main", seq: 1, state: "delta", message: { role: "assistant", content: [{ type: "text", text: "hello " }], timestamp: 1 } });
      server.emitEvent("session.tool", { runId: "r1", seq: 1, stream: "tool", ts: 1, sessionKey: "main", data: { phase: "start", name: "search", toolCallId: "t1", args: {} } });
      server.emitEvent("session.tool", { runId: "r1", seq: 2, stream: "tool", ts: 2, sessionKey: "main", data: { phase: "result", name: "search", toolCallId: "t1", isError: false, result: "ok" } });
      server.emitEvent("chat", { runId: "r1", sessionKey: "main", seq: 4, state: "final", message: { role: "assistant", content: [{ type: "text", text: "hello world" }], timestamp: 1 } });
    }, 50));

    const out: unknown[] = [];
    for await (const e of c.sendMessage("main", "hi")) out.push(e);
    expect(out).toContainEqual({ type: "token", text: "hello " });
    expect(out).toContainEqual({ type: "tool_call", id: "t1", name: "search", args: {} });
    expect(out).toContainEqual({ type: "tool_result", id: "t1", result: "ok" });
    expect(out).toContainEqual({ type: "token", text: "world" });
    expect(out).toContainEqual({ type: "done" });
    await conn.close();
  });

  it("sendMessage handles error state from chat events", async () => {
    const conn = GatewayConnection.fromConfig({ url: gw.httpUrl, token: "t", source: "file" });
    await conn.ready();
    const c = createClient(conn);

    queueMicrotask(() => setTimeout(() => {
      server.emitEvent("chat", { runId: "r1", sessionKey: "main", seq: 1, state: "error", errorMessage: "boom" });
    }, 50));

    const out: unknown[] = [];
    for await (const e of c.sendMessage("main", "hi")) out.push(e);
    expect(out).toContainEqual({ type: "error", message: "boom" });
    await conn.close();
  });
});

describe("createClient — listAgents and createSession", () => {
  it("listAgents returns an array mapped to id/label", async () => {
    gw.onClient((c) => {
      c.onRequest(async (method) => {
        if (method === "agents.list") return { ok: true, payload: { agents: [
          { id: "main", displayName: "Main", model: "kimi/kimi-code" },
          { id: "test", label: "Test agent" },
        ]}};
        return { ok: false, error: { message: "no" } };
      });
    });
    const conn = GatewayConnection.fromConfig({ url: gw.httpUrl, token: "t", source: "file" });
    await conn.ready();
    const c = createClient(conn);
    const out = await c.listAgents();
    expect(out).toEqual([
      { id: "main", label: "Main", model: "kimi/kimi-code" },
      { id: "test", label: "Test agent" },
    ]);
    await conn.close();
  });

  it("createSession invokes sessions.create with namespaced key and returns SessionSummary", async () => {
    let createCallParams: unknown = null;
    gw.onClient((c) => {
      c.onRequest(async (method, params) => {
        if (method === "sessions.create") {
          createCallParams = params;
          const key = (params as { key: string }).key;
          return { ok: true, payload: { key, displayName: "New chat", hasActiveRun: false } };
        }
        return { ok: false, error: { message: "no" } };
      });
    });
    const conn = GatewayConnection.fromConfig({ url: gw.httpUrl, token: "t", source: "file" });
    await conn.ready();
    const c = createClient(conn);
    const r = await c.createSession({ label: "New chat" });
    expect(r.id).toMatch(/^web:/);
    expect(r.title).toBe("New chat");
    expect((createCallParams as { agentId: string; label: string }).agentId).toBe("main");
    expect((createCallParams as { label: string }).label).toBe("New chat");
    await conn.close();
  });

  it("patchSessionLabel invokes sessions.patch", async () => {
    let patchParams: unknown = null;
    gw.onClient((c) => {
      c.onRequest(async (method, params) => {
        if (method === "sessions.patch") {
          patchParams = params;
          return { ok: true, payload: { ok: true } };
        }
        return { ok: false, error: { message: "no" } };
      });
    });
    const conn = GatewayConnection.fromConfig({ url: gw.httpUrl, token: "t", source: "file" });
    await conn.ready();
    const c = createClient(conn);
    await c.patchSessionLabel("web:abc", "Renamed");
    expect((patchParams as { key: string; label: string }).key).toBe("web:abc");
    expect((patchParams as { label: string }).label).toBe("Renamed");
    await conn.close();
  });
});
