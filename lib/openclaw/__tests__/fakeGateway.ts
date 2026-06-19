import { WebSocketServer } from "ws";
import type { AddressInfo } from "node:net";

export type FakeGateway = {
  url: string;
  httpUrl: string;
  onClient: (cb: (client: FakeClient) => void) => void;
  close: () => Promise<void>;
};

export type FakeClient = {
  emitEvent: (event: string, payload: unknown, opts?: { seq?: number }) => void;
  onRequest: (handler: (method: string, params: unknown, id: string) => Promise<{ ok: true; payload?: unknown } | { ok: false; error: { message: string } }>) => void;
  close: () => void;
};

const SHARED_TOKEN_HOLDER = { token: null as string | null };

export function setExpectedToken(t: string | null) { SHARED_TOKEN_HOLDER.token = t; }

export async function startFakeGateway(): Promise<FakeGateway> {
  const wss = new WebSocketServer({ port: 0 });
  await new Promise<void>((res) => wss.once("listening", () => res()));
  const port = (wss.address() as AddressInfo).port;
  let onClient: ((c: FakeClient) => void) | null = null;

  wss.on("connection", (ws) => {
    let requestHandler:
      | ((method: string, params: unknown, id: string) => Promise<{ ok: boolean; payload?: unknown; error?: { message: string } }>)
      | null = null;

    // 1) Push the connect.challenge
    ws.send(JSON.stringify({
      type: "event",
      event: "connect.challenge",
      payload: { nonce: "test-nonce", ts: Date.now() },
    }));

    let connected = false;

    ws.on("message", async (raw) => {
      let frame: { type?: string; id?: string; method?: string; params?: unknown };
      try { frame = JSON.parse(String(raw)); } catch { return; }

      // Handshake
      if (!connected) {
        if (frame.type === "req" && frame.method === "connect") {
          const tokenOk = SHARED_TOKEN_HOLDER.token === null
            || (frame.params as { auth?: { token?: string } } | undefined)?.auth?.token === SHARED_TOKEN_HOLDER.token;
          if (!tokenOk) {
            ws.send(JSON.stringify({ type: "res", id: frame.id, ok: false, error: { message: "bad-token" } }));
            ws.close();
            return;
          }
          ws.send(JSON.stringify({
            type: "res", id: frame.id, ok: true,
            payload: {
              type: "hello-ok",
              protocol: 4,
              server: { version: "fake", connId: "c1" },
              features: { methods: ["health", "sessions.list", "chat.history", "chat.send", "chat.abort", "sessions.messages.subscribe", "sessions.messages.unsubscribe", "sessions.subscribe", "sessions.unsubscribe"], events: ["session.message", "session.tool", "chat"] },
              snapshot: {},
              policy: { maxPayload: 1_048_576, maxBufferedBytes: 1_048_576, tickIntervalMs: 30_000 },
              auth: { role: "operator", scopes: ["operator.read", "operator.write"] },
            },
          }));
          connected = true;
          // Surface a FakeClient to the test
          const client: FakeClient = {
            emitEvent: (event, payload, opts) => {
              ws.send(JSON.stringify({ type: "event", event, payload, seq: opts?.seq }));
            },
            onRequest: (h) => { requestHandler = h; },
            close: () => ws.close(),
          };
          onClient?.(client);
          return;
        }
        // Anything before connect is a protocol violation
        ws.close();
        return;
      }

      // Post-handshake RPC
      if (frame.type === "req" && requestHandler) {
        try {
          const r = await requestHandler(frame.method!, frame.params, frame.id!);
          ws.send(JSON.stringify({ type: "res", id: frame.id, ...r }));
        } catch (e) {
          ws.send(JSON.stringify({ type: "res", id: frame.id, ok: false, error: { message: (e as Error).message } }));
        }
      }
    });
  });

  return {
    url: `ws://127.0.0.1:${port}`,
    httpUrl: `http://127.0.0.1:${port}`,
    onClient: (cb) => { onClient = cb; },
    close: () => new Promise((res) => wss.close(() => res())),
  };
}
