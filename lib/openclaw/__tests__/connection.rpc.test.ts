// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { startFakeGateway, setExpectedToken, type FakeGateway } from "./fakeGateway";
import { GatewayConnection } from "../connection";

let gw: FakeGateway;

beforeEach(async () => { gw = await startFakeGateway(); setExpectedToken(null); });
afterEach(async () => { await gw.close(); });

describe("GatewayConnection.invoke", () => {
  it("dispatches a req and resolves with payload", async () => {
    gw.onClient((c) => {
      c.onRequest(async (method) => {
        if (method === "sessions.list") return { ok: true, payload: { sessions: [{ id: "s1", title: "t" }] } };
        return { ok: false, error: { message: "unknown method" } };
      });
    });
    const conn = GatewayConnection.fromConfig({ url: gw.httpUrl, token: "tok", source: "file" });
    await conn.ready();
    const payload = await conn.invoke("sessions.list", {});
    expect(payload).toEqual({ sessions: [{ id: "s1", title: "t" }] });
    await conn.close();
  });

  it("rejects when res.ok is false", async () => {
    gw.onClient((c) => {
      c.onRequest(async () => ({ ok: false, error: { message: "boom" } }));
    });
    const conn = GatewayConnection.fromConfig({ url: gw.httpUrl, token: "tok", source: "file" });
    await conn.ready();
    await expect(conn.invoke("anything", {})).rejects.toThrow(/boom/);
    await conn.close();
  });

  it("aborts a pending invoke when signal fires", async () => {
    gw.onClient((c) => {
      c.onRequest(() => new Promise(() => {})); // never resolves
    });
    const conn = GatewayConnection.fromConfig({ url: gw.httpUrl, token: "tok", source: "file" });
    await conn.ready();
    const ac = new AbortController();
    const p = conn.invoke("slow", {}, ac.signal);
    setTimeout(() => ac.abort(), 20);
    await expect(p).rejects.toThrow(/abort/i);
    await conn.close();
  });
});
