import http from "node:http";
import { WebSocketServer } from "ws";

export async function startFakeGateway(port: number, token: string) {
  const server = http.createServer((_req, res) => { res.statusCode = 404; res.end(); });
  const wss = new WebSocketServer({ server });

  wss.on("connection", (ws) => {
    let connected = false;

    ws.send(JSON.stringify({
      type: "event", event: "connect.challenge", payload: { nonce: "n", ts: Date.now() },
    }));

    ws.on("message", (raw) => {
      let f: { type?: string; id?: string; method?: string; params?: unknown };
      try { f = JSON.parse(String(raw)); } catch { return; }

      // Handshake
      if (!connected && f.type === "req" && f.method === "connect") {
        const t = (f.params as { auth?: { token?: string } } | undefined)?.auth?.token;
        if (t !== token) {
          ws.send(JSON.stringify({ type: "res", id: f.id, ok: false, error: { message: "bad-token" } }));
          ws.close();
          return;
        }
        ws.send(JSON.stringify({
          type: "res", id: f.id, ok: true,
          payload: {
            type: "hello-ok", protocol: 4,
            server: { version: "fake", connId: "c1" },
            features: { methods: [], events: ["session.message", "session.tool", "chat"] },
            snapshot: {},
            policy: { maxPayload: 1_048_576, maxBufferedBytes: 1_048_576, tickIntervalMs: 30_000 },
            auth: { role: "operator", scopes: ["operator.read", "operator.write"] },
          },
        }));
        connected = true;
        return;
      }

      if (!connected || f.type !== "req") return;

      const params = f.params as Record<string, unknown> | undefined;

      if (f.method === "sessions.list") {
        ws.send(JSON.stringify({ type: "res", id: f.id, ok: true, payload: {
          ts: Date.now(), path: "fake", count: 2, totalCount: 2, limitApplied: false, hasMore: false, defaults: {},
          sessions: [
            { key: "agent:silver-wolf:main", displayName: "Silver Wolf", hasActiveRun: false },
            { key: "agent:main:main", displayName: "Main", hasActiveRun: false },
          ],
        }}));
        return;
      }
      if (f.method === "agents.list") {
        // Sidebar is agent-driven: one row per agent, each backed by `app:<agent>`.
        ws.send(JSON.stringify({ type: "res", id: f.id, ok: true, payload: {
          agents: [
            { id: "silver-wolf", label: "silver-wolf" },
            { id: "main", label: "main" },
          ],
        }}));
        return;
      }
      if (f.method === "sessions.create") {
        const p = params as { key?: string; agentId?: string; label?: string } | undefined;
        // Mirror the real gateway: a created key is namespaced under its agent,
        // so `app:<agent>` is stored as `agent:<agent>:app:<agent>`.
        const finalKey = p?.agentId ? `agent:${p.agentId}:${p.key ?? "app"}` : (p?.key ?? "app:main");
        ws.send(JSON.stringify({ type: "res", id: f.id, ok: true, payload: { key: finalKey, displayName: p?.label, label: p?.label } }));
        return;
      }
      if (f.method === "chat.history") {
        const sessionKey = (params as { sessionKey?: string } | undefined)?.sessionKey ?? "main";
        // Seed a long history so the thread overflows and is scrollable — needed
        // to exercise the "land at the bottom, don't animate from the top on tab
        // switch" behaviour (MessageList scroll handling).
        const tag = sessionKey.includes("silver-wolf") ? "Alpha" : "Beta";
        const messages = Array.from({ length: 40 }, (_, i) => ({
          role: i % 2 === 0 ? "user" : "assistant",
          text: `${tag} message ${i + 1} — lorem ipsum dolor sit amet consectetur adipiscing elit.`,
        }));
        ws.send(JSON.stringify({ type: "res", id: f.id, ok: true, payload: {
          sessionKey, sessionId: undefined, messages,
          thinkingLevel: undefined, fastMode: undefined, verboseLevel: undefined,
        }}));
        return;
      }
      if (f.method === "health") {
        ws.send(JSON.stringify({ type: "res", id: f.id, ok: true, payload: { ok: true, ts: Date.now() } }));
        return;
      }
      if (f.method === "sessions.messages.subscribe" || f.method === "sessions.subscribe") {
        const key = (params as { key?: string } | undefined)?.key ?? "main";
        ws.send(JSON.stringify({ type: "res", id: f.id, ok: true, payload: { subscribed: true, key } }));
        return;
      }
      if (f.method === "sessions.messages.unsubscribe" || f.method === "sessions.unsubscribe") {
        const key = (params as { key?: string } | undefined)?.key ?? "main";
        ws.send(JSON.stringify({ type: "res", id: f.id, ok: true, payload: { subscribed: false, key } }));
        return;
      }
      if (f.method === "chat.send") {
        const sessionKey = (params as { sessionKey?: string } | undefined)?.sessionKey ?? "main";
        ws.send(JSON.stringify({ type: "res", id: f.id, ok: true, payload: { runId: "r1", status: "started" } }));
        // Drive a streamed agent turn via protocol v4 chat deltaText events.
        setTimeout(() => {
          // chat delta 1: "hello "
          ws.send(JSON.stringify({ type: "event", event: "chat", payload: {
            runId: "r1", sessionKey, seq: 1, state: "delta", deltaText: "hello ",
            message: { role: "assistant", content: [{ type: "text", text: "hello " }], timestamp: Date.now() },
          }}));
          // tool start
          ws.send(JSON.stringify({ type: "event", event: "session.tool", payload: {
            runId: "r1", seq: 1, stream: "tool", ts: Date.now(), sessionKey,
            data: { phase: "start", name: "search", toolCallId: "t1", args: { q: "x" } },
          }}));
          // tool result
          ws.send(JSON.stringify({ type: "event", event: "session.tool", payload: {
            runId: "r1", seq: 2, stream: "tool", ts: Date.now(), sessionKey,
            data: { phase: "result", name: "search", toolCallId: "t1", isError: false, result: "ok" },
          }}));
          // chat delta 2: stream a typo, then replace it with the corrected full text.
          ws.send(JSON.stringify({ type: "event", event: "chat", payload: {
            runId: "r1", sessionKey, seq: 4, state: "delta", deltaText: "worl",
            message: { role: "assistant", content: [{ type: "text", text: "hello worl" }], timestamp: Date.now() },
          }}));
          ws.send(JSON.stringify({ type: "event", event: "chat", payload: {
            runId: "r1", sessionKey, seq: 5, state: "delta", deltaText: "hello world", replace: true,
            message: { role: "assistant", content: [{ type: "text", text: "hello world" }], timestamp: Date.now() },
          }}));
          // chat final
          ws.send(JSON.stringify({ type: "event", event: "chat", payload: {
            runId: "r1", sessionKey, seq: 6, state: "final",
            message: { role: "assistant", content: [{ type: "text", text: "hello world" }], timestamp: Date.now() },
          }}));
        }, 50);
        return;
      }
      if (f.method === "chat.abort") {
        ws.send(JSON.stringify({ type: "res", id: f.id, ok: true, payload: { ok: true, aborted: true, runIds: ["r1"] } }));
        return;
      }
      ws.send(JSON.stringify({ type: "res", id: f.id, ok: false, error: { message: "method not implemented in fake" } }));
    });
  });

  await new Promise<void>((res) => server.listen(port, "127.0.0.1", () => res()));
  return () => new Promise<void>((res) => server.close(() => res()));
}
