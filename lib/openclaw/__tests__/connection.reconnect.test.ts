// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { startFakeGateway, type FakeGateway, type FakeClient } from "./fakeGateway";
import { GatewayConnection } from "../connection";

let gw: FakeGateway;

beforeEach(async () => { gw = await startFakeGateway(); });
afterEach(async () => { await gw.close(); });

describe("GatewayConnection.reconnect", () => {
  it("re-issues subscriptions after the connection drops", async () => {
    let firstClient!: FakeClient;
    let secondClient!: FakeClient;
    let count = 0;
    const subscribeCalls: { which: number; method: string; key: string }[] = [];
    gw.onClient((c) => {
      count++;
      const which = count;
      if (which === 1) firstClient = c;
      if (which === 2) secondClient = c;
      c.onRequest(async (method, params) => {
        const key = (params as { key?: string } | undefined)?.key ?? "";
        if (method === "sessions.messages.subscribe" || method === "sessions.subscribe") {
          subscribeCalls.push({ which, method, key });
          return { ok: true, payload: { subscribed: true, key } };
        }
        if (method === "sessions.messages.unsubscribe" || method === "sessions.unsubscribe") {
          return { ok: true, payload: { subscribed: false, key } };
        }
        return { ok: false, error: { message: "no" } };
      });
    });

    const conn = GatewayConnection.fromConfig({ url: gw.httpUrl, token: "t", source: "file" });
    await conn.ready();
    const sub = conn.subscribe("main");
    await new Promise((r) => setTimeout(r, 50));

    const collected: number[] = [];
    const reader = (async () => {
      for await (const e of sub.events) collected.push((e.payload as { seq?: number }).seq ?? 0);
    })();

    firstClient.emitEvent("chat", { sessionKey: "main", runId: "r1", seq: 1, state: "delta" });
    await new Promise((r) => setTimeout(r, 30));

    // Drop the first connection
    firstClient.close();
    // Wait for reconnect (backoff initial 250ms, then handshake)
    await new Promise((r) => setTimeout(r, 1500));

    expect(count).toBeGreaterThanOrEqual(2);
    secondClient.emitEvent("chat", { sessionKey: "main", runId: "r1", seq: 2, state: "delta" });
    await new Promise((r) => setTimeout(r, 50));
    await sub.unsubscribe();
    await reader;
    expect(collected).toEqual([1, 2]);

    // Re-subscribe should have happened on the second connection too
    const secondConnSubs = subscribeCalls.filter((c) => c.which === 2);
    expect(secondConnSubs.some((c) => c.method === "sessions.messages.subscribe" && c.key === "main")).toBe(true);
    expect(secondConnSubs.some((c) => c.method === "sessions.subscribe" && c.key === "main")).toBe(true);

    await conn.close();
  });
});
