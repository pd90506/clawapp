// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { startFakeGateway, type FakeGateway, type FakeClient } from "./fakeGateway";
import { GatewayConnection } from "../connection";

let gw: FakeGateway;
let server: FakeClient;
let subscribeCalls: { method: string; params: unknown }[] = [];

beforeEach(async () => {
  gw = await startFakeGateway();
  subscribeCalls = [];
  gw.onClient((c) => {
    server = c;
    c.onRequest(async (method, params) => {
      subscribeCalls.push({ method, params });
      if (method === "sessions.messages.subscribe") return { ok: true, payload: { subscribed: true, key: (params as { key: string }).key } };
      if (method === "sessions.subscribe") return { ok: true, payload: { subscribed: true, key: (params as { key: string }).key } };
      if (method === "sessions.messages.unsubscribe") return { ok: true, payload: { subscribed: false, key: (params as { key: string }).key } };
      if (method === "sessions.unsubscribe") return { ok: true, payload: { subscribed: false, key: (params as { key: string }).key } };
      return { ok: false, error: { message: "no" } };
    });
  });
});
afterEach(async () => { await gw.close(); });

describe("GatewayConnection.subscribe", () => {
  it("calls sessions.messages.subscribe AND sessions.subscribe with key:<sessionKey>", async () => {
    const conn = GatewayConnection.fromConfig({ url: gw.httpUrl, token: "t", source: "file" });
    await conn.ready();
    const sub = conn.subscribe("main");
    await new Promise((r) => setTimeout(r, 30));
    expect(subscribeCalls.some((c) => c.method === "sessions.messages.subscribe" && (c.params as { key: string }).key === "main")).toBe(true);
    expect(subscribeCalls.some((c) => c.method === "sessions.subscribe" && (c.params as { key: string }).key === "main")).toBe(true);
    await sub.unsubscribe();
    await conn.close();
  });

  it("yields events that match the subscribed sessionKey", async () => {
    const conn = GatewayConnection.fromConfig({ url: gw.httpUrl, token: "t", source: "file" });
    await conn.ready();
    const sub = conn.subscribe("main");
    await new Promise((r) => setTimeout(r, 30));

    const collected: { event: string; sessionKey: string }[] = [];
    const reader = (async () => {
      for await (const e of sub.events) {
        collected.push({ event: e.event, sessionKey: (e.payload as { sessionKey: string }).sessionKey });
      }
    })();

    server.emitEvent("session.message", { sessionKey: "main", message: { role: "assistant", content: "hi" } });
    server.emitEvent("chat", { sessionKey: "main", runId: "r1", seq: 1, state: "delta", message: { role: "assistant", content: [{ type: "text", text: "hi" }] } });
    await new Promise((r) => setTimeout(r, 30));
    await sub.unsubscribe();
    await reader;
    expect(collected.length).toBe(2);
    expect(collected.every((c) => c.sessionKey === "main")).toBe(true);
    await conn.close();
  });

  it("filters out events for other sessionKeys", async () => {
    const conn = GatewayConnection.fromConfig({ url: gw.httpUrl, token: "t", source: "file" });
    await conn.ready();
    const sub = conn.subscribe("main");
    await new Promise((r) => setTimeout(r, 30));

    const collected: unknown[] = [];
    const reader = (async () => { for await (const e of sub.events) collected.push(e); })();

    server.emitEvent("chat", { sessionKey: "other", runId: "r1", seq: 1, state: "delta" });
    server.emitEvent("session.message", { sessionKey: "other", message: { role: "assistant", content: "x" } });
    await new Promise((r) => setTimeout(r, 30));
    expect(collected.length).toBe(0);

    server.emitEvent("chat", { sessionKey: "main", runId: "r1", seq: 1, state: "delta" });
    await new Promise((r) => setTimeout(r, 30));
    expect(collected.length).toBe(1);

    await sub.unsubscribe();
    await reader;
    await conn.close();
  });

  it("fans out events to multiple subscribers of the same sessionKey", async () => {
    const conn = GatewayConnection.fromConfig({ url: gw.httpUrl, token: "t", source: "file" });
    await conn.ready();
    const a = conn.subscribe("main");
    const b = conn.subscribe("main");
    await new Promise((r) => setTimeout(r, 30));

    const aOut: number[] = []; const bOut: number[] = [];
    const ra = (async () => { for await (const e of a.events) aOut.push(((e.payload as { seq?: number }).seq) ?? 0); })();
    const rb = (async () => { for await (const e of b.events) bOut.push(((e.payload as { seq?: number }).seq) ?? 0); })();

    server.emitEvent("chat", { sessionKey: "main", runId: "r1", seq: 1, state: "delta" });
    await new Promise((r) => setTimeout(r, 30));
    await a.unsubscribe(); await b.unsubscribe();
    await Promise.all([ra, rb]);
    expect(aOut).toEqual([1]);
    expect(bOut).toEqual([1]);
    await conn.close();
  });

  it("only sends one upstream subscribe per sessionKey when multiple subscribers refcount", async () => {
    const conn = GatewayConnection.fromConfig({ url: gw.httpUrl, token: "t", source: "file" });
    await conn.ready();
    const a = conn.subscribe("main");
    const b = conn.subscribe("main");
    await new Promise((r) => setTimeout(r, 30));

    const subCount = subscribeCalls.filter((c) => c.method === "sessions.messages.subscribe" && (c.params as { key: string }).key === "main").length;
    expect(subCount).toBe(1); // only first subscriber sends the upstream req
    await a.unsubscribe(); await b.unsubscribe();
    await conn.close();
  });
});
