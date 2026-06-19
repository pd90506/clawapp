// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { WebSocketServer } from "ws";
import type { AddressInfo } from "node:net";
import { startFakeGateway, setExpectedToken, type FakeGateway } from "./fakeGateway";
import { GatewayConnection } from "../connection";

let gw: FakeGateway;

beforeEach(async () => { gw = await startFakeGateway(); setExpectedToken(null); });
afterEach(async () => { await gw.close(); });

describe("GatewayConnection.handshake", () => {
  it("completes the connect handshake and resolves ready()", async () => {
    setExpectedToken("tok");
    const conn = GatewayConnection.fromConfig({ url: gw.httpUrl, token: "tok", source: "file" });
    await conn.ready();
    await conn.close();
  });

  it("rejects ready() on bad token", async () => {
    setExpectedToken("good");
    const conn = GatewayConnection.fromConfig({ url: gw.httpUrl, token: "bad", source: "file" });
    await expect(conn.ready()).rejects.toThrow(/bad-token|handshake/);
    await conn.close();
  });

  it("negotiates with gateways that require protocol 4", async () => {
    const wss = new WebSocketServer({ port: 0 });
    await new Promise<void>((res) => wss.once("listening", res));
    const port = (wss.address() as AddressInfo).port;
    let connectParams: { minProtocol?: number; maxProtocol?: number } | null = null;

    wss.on("connection", (ws) => {
      ws.send(JSON.stringify({ type: "event", event: "connect.challenge", payload: { nonce: "n", ts: 1 } }));
      ws.on("message", (raw) => {
        const frame = JSON.parse(String(raw)) as { id: string; params?: { minProtocol?: number; maxProtocol?: number } };
        connectParams = frame.params ?? null;
        const ok = (connectParams?.minProtocol ?? 0) <= 4 && (connectParams?.maxProtocol ?? 0) >= 4;
        ws.send(JSON.stringify(ok
          ? {
              type: "res",
              id: frame.id,
              ok: true,
              payload: {
                type: "hello-ok",
                protocol: 4,
                server: { version: "fake", connId: "c1" },
                features: { methods: [], events: [] },
                snapshot: {},
                auth: { role: "operator", scopes: ["operator.read"] },
                policy: { maxPayload: 1_048_576, maxBufferedBytes: 1_048_576, tickIntervalMs: 30_000 },
              },
            }
          : { type: "res", id: frame.id, ok: false, error: { message: "protocol mismatch" } }));
      });
    });

    const conn = GatewayConnection.fromConfig({ url: `http://127.0.0.1:${port}`, token: "tok", source: "file" });
    await conn.ready();
    expect(connectParams).toMatchObject({ minProtocol: 3, maxProtocol: 4 });
    await conn.close();
    await new Promise<void>((res) => wss.close(() => res()));
  });
});
