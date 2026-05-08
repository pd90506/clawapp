# clawapp v1.1 (real openclaw gateway via WS) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite `lib/openclaw` so the v1 frontend talks to a real openclaw gateway via its native WebSocket protocol — handshake, RPC dispatch, fan-out subscriptions, reconnect, and an adapter that maps openclaw transcript events to the existing `StreamEvent` union.

**Architecture:** A `GatewayConnection` class owns one persistent WS to `ws://127.0.0.1:18789/`. It does the `connect` handshake as a backend client, dispatches RPCs by frame `id`, and fans subscribed `session.message`/`session.tool` events out to multiple consumers. `client.ts` keeps its v1 public surface (so frontend, hooks, routes, components don't change) and routes calls through the connection. An `adapter.ts` module is the single place that maps openclaw event shapes to v1's internal `StreamEvent`.

**Tech Stack:** Same as v1 — TypeScript, `ws`, `zod`, Vitest, Playwright. No new deps.

**Spec:** [docs/superpowers/specs/2026-05-08-openclaw-gateway-ws-v1.1-design.md](../specs/2026-05-08-openclaw-gateway-ws-v1.1-design.md)

**Branch:** `feat/v1.1-real-gateway` (already created off `feat/v1-chat-app`).

---

## File map (locked at plan time)

```
clawapp/
├── lib/openclaw/
│   ├── config.ts                  (unchanged)
│   ├── events.ts                  (extended: add TranscriptEvent schema; keep StreamEvent)
│   ├── protocol.ts                (new) frame-level zod schemas (req/res/event, errors, hello-ok)
│   ├── connection.ts              (new) GatewayConnection class — handshake/RPC/subs/reconnect
│   ├── adapter.ts                 (new) pure TranscriptEvent → StreamEvent reducer
│   ├── client.ts                  (rewritten) Client surface unchanged; internals route through connection
│   ├── index.ts                   (updated) singleton wiring
│   └── __tests__/
│       ├── config.test.ts         (unchanged)
│       ├── events.test.ts         (extended)
│       ├── fakeGateway.ts         (replaces fakeWsServer.ts) protocol-aware fake server
│       ├── protocol.test.ts       (new)
│       ├── connection.handshake.test.ts (new)
│       ├── connection.rpc.test.ts (new)
│       ├── connection.subscribe.test.ts (new)
│       ├── connection.reconnect.test.ts (new)
│       ├── adapter.test.ts        (new)
│       └── client.test.ts         (replaces client.http.test.ts + client.stream.test.ts)
├── e2e/fixtures/gateway.ts        (rewritten for new protocol)
└── e2e/chat.spec.ts               (assertions unchanged; fixture rewritten)
```

Existing v1 files outside `lib/openclaw/` stay green throughout — `app/api/*`, `hooks/*`, `components/*`, `app/page.tsx`, `app/ChatPage.tsx`, etc. are not touched in this plan.

---

## Approach to research-flavored tasks

The exact wire shapes (frame keys, `hello-ok` policy fields, transcript event payloads) need to be confirmed against the running gateway. Tasks 1, 5, and 9 are **discovery + lock-down** tasks — the implementer reads the openclaw source tree at `/opt/homebrew/lib/node_modules/openclaw/` and writes zod schemas that match what they find. They commit those schemas as the source of truth for downstream tasks.

Read in priority order:
1. `/opt/homebrew/lib/node_modules/openclaw/docs/gateway/protocol.md` — high-level shapes.
2. `/opt/homebrew/lib/node_modules/openclaw/dist/gateway/protocol/index.js` — actual TS-compiled schema.
3. `/opt/homebrew/lib/node_modules/openclaw/dist/gateway/server-methods/` — method handlers (event payload shapes for `session.message`, `session.tool`).

If the implementer can't fully resolve a shape from source, they should write the most permissive zod schema that captures the fields the adapter consumes (`role`, `text`, `seq`, etc.) using `z.object({...}).passthrough()` and document the open question at the top of the schema. Don't block on undiscoverable fields.

---

## Task 1: Lock-down — read openclaw protocol & document discovery

**Files:**
- Create: `docs/openclaw-protocol-notes.md` (notes file, not committed to spec dir — it's reference-grade and may evolve)

- [ ] **Step 1: Read protocol docs and source**

```bash
ls /opt/homebrew/lib/node_modules/openclaw/dist/gateway/
ls /opt/homebrew/lib/node_modules/openclaw/dist/gateway/protocol/
ls /opt/homebrew/lib/node_modules/openclaw/dist/gateway/server-methods/
```

Read at minimum:
- `protocol.md` (already partially extracted in spec).
- `dist/gateway/protocol/index.js` — schema definitions.
- `dist/gateway/server-methods/sessions.list.js`, `chat.send.js`, `chat.history.js`, `health.js`.
- The events emitted from `session.message` / `session.tool` — search the dist tree: `grep -rl "session.message" /opt/homebrew/lib/node_modules/openclaw/dist/gateway/` and read each match.

- [ ] **Step 2: Write `docs/openclaw-protocol-notes.md`**

Capture concretely (copy verbatim quotes/snippets where helpful):

```markdown
# openclaw gateway protocol — implementation notes

## Frame envelope
- req:   {type:"req", id:string, method:string, params:object}
- res:   {type:"res", id:string, ok:boolean, payload?:any, error?:{...}}
- event: {type:"event", event:string, payload:object, seq?:number, stateVersion?:number}

## Handshake
1. server pushes event "connect.challenge" {nonce, ts}
2. client sends req "connect" {minProtocol, maxProtocol, client, role, scopes, auth, ...}
3. server replies res ok=true with hello-ok payload {protocol, server, features:{methods, events}, policy:{maxPayload, maxBufferedBytes, tickIntervalMs}, auth:{role, scopes}}

## Backend identity (loopback shared-secret)
client.id="gateway-client", client.mode="backend", auth={token: "<bearer>"}, no device.

## Methods we use
- health         — params {}, payload {ok|status|...}
- sessions.list  — params {}, payload {sessions:[{id|key, title, ...}, ...]}
- chat.history   — params {sessionKey}, payload {messages:[{role, text, at|createdAt, ...}, ...]}
- sessions.messages.subscribe   — params {sessionKey}, payload {ok}
- sessions.messages.unsubscribe — params {sessionKey}, payload {ok}
- chat.send      — params {sessionKey, text, ...?}, payload {runId?, ok}
- chat.abort     — params {sessionKey, runId?}, payload {ok}

## Events (broadcast post-subscribe)
- "session.message" — payload (fill in after reading dist)
- "session.tool"    — payload (fill in after reading dist)
- "chat" / "chat.inject" — payload (fill in after reading dist)

## Notes / surprises
- (record anything found that contradicts spec assumptions)
```

Fill in the `(fill in...)` lines with real shapes from source. If something can't be determined, write `unknown — see <file:line>` and continue.

- [ ] **Step 3: Commit**

```bash
git add docs/openclaw-protocol-notes.md
git commit -m "docs: openclaw gateway protocol implementation notes"
```

---

## Task 2: `lib/openclaw/protocol.ts` — frame-level zod schemas

**Files:**
- Create: `lib/openclaw/protocol.ts`, `lib/openclaw/__tests__/protocol.test.ts`

- [ ] **Step 1: Write failing test** at `lib/openclaw/__tests__/protocol.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { parseFrame, makeRequest, makeId } from "../protocol";

describe("protocol frames", () => {
  it("parses a res frame", () => {
    const f = parseFrame({ type: "res", id: "1", ok: true, payload: { sessions: [] } });
    expect(f).toMatchObject({ type: "res", id: "1", ok: true });
  });
  it("parses an event frame", () => {
    const f = parseFrame({ type: "event", event: "session.message", payload: { x: 1 }, seq: 7 });
    expect(f).toMatchObject({ type: "event", event: "session.message", seq: 7 });
  });
  it("returns null on unknown shape", () => {
    expect(parseFrame({ type: "wat" })).toBeNull();
    expect(parseFrame("nope")).toBeNull();
  });
  it("makeRequest produces a req frame with stable shape", () => {
    const r = makeRequest("sessions.list", {});
    expect(r.type).toBe("req");
    expect(typeof r.id).toBe("string");
    expect(r.id.length).toBeGreaterThan(0);
    expect(r.method).toBe("sessions.list");
    expect(r.params).toEqual({});
  });
  it("makeId returns unique ids", () => {
    const a = makeId(); const b = makeId();
    expect(a).not.toBe(b);
  });
});
```

- [ ] **Step 2: Run, expect FAIL**

```bash
pnpm test lib/openclaw/__tests__/protocol.test.ts
```

- [ ] **Step 3: Implement `lib/openclaw/protocol.ts`**

```ts
import { z } from "zod";

export const ReqFrameSchema = z.object({
  type: z.literal("req"),
  id: z.string(),
  method: z.string(),
  params: z.unknown().optional(),
});

export const ResFrameSchema = z.object({
  type: z.literal("res"),
  id: z.string(),
  ok: z.boolean(),
  payload: z.unknown().optional(),
  error: z.object({ code: z.string().optional(), message: z.string() }).passthrough().optional(),
});

export const EventFrameSchema = z.object({
  type: z.literal("event"),
  event: z.string(),
  payload: z.unknown(),
  seq: z.number().optional(),
  stateVersion: z.number().optional(),
}).passthrough();

export const FrameSchema = z.discriminatedUnion("type", [
  ReqFrameSchema, ResFrameSchema, EventFrameSchema,
]);

export type ReqFrame = z.infer<typeof ReqFrameSchema>;
export type ResFrame = z.infer<typeof ResFrameSchema>;
export type EventFrame = z.infer<typeof EventFrameSchema>;
export type Frame = z.infer<typeof FrameSchema>;

export function parseFrame(input: unknown): Frame | null {
  const r = FrameSchema.safeParse(input);
  return r.success ? r.data : null;
}

let counter = 0;
export function makeId(): string {
  counter++;
  return `${Date.now().toString(36)}-${counter.toString(36)}`;
}

export function makeRequest(method: string, params: unknown): ReqFrame {
  return { type: "req", id: makeId(), method, params };
}
```

- [ ] **Step 4: Run, expect PASS** (5 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/openclaw/protocol.ts lib/openclaw/__tests__/protocol.test.ts
git commit -m "feat(openclaw): protocol frame schemas (req/res/event)"
```

---

## Task 3: Extend `events.ts` with TranscriptEvent schema

**Files:**
- Modify: `lib/openclaw/events.ts`
- Modify: `lib/openclaw/__tests__/events.test.ts`

- [ ] **Step 1: Add failing tests** to `events.test.ts`:

Append the following block to the existing test file:

```ts
import { parseTranscriptEvent } from "../events";

describe("parseTranscriptEvent", () => {
  it("parses a session.message text event", () => {
    const e = parseTranscriptEvent("session.message", {
      sessionKey: "s1", role: "assistant", text: "hello", seq: 5,
    });
    expect(e?.kind).toBe("message");
  });
  it("parses a session.tool start event", () => {
    const e = parseTranscriptEvent("session.tool", {
      sessionKey: "s1", phase: "start", id: "t1", name: "search", args: { q: "x" },
    });
    expect(e?.kind).toBe("tool");
    if (e?.kind === "tool") expect(e.phase).toBe("start");
  });
  it("returns null for unknown event names", () => {
    expect(parseTranscriptEvent("session.unknown", {})).toBeNull();
  });
});
```

- [ ] **Step 2: Run, expect FAIL**

- [ ] **Step 3: Extend `lib/openclaw/events.ts`**

Append to the existing file:

```ts
const MessageEventPayload = z.object({
  sessionKey: z.string(),
  role: z.string(),         // "assistant" | "user" | "system" | "thinking" | ...
  text: z.string().optional(),
  delta: z.string().optional(),  // some emitters use delta vs text — accept both
  seq: z.number().optional(),
  done: z.boolean().optional(),
}).passthrough();

const ToolEventPayload = z.object({
  sessionKey: z.string(),
  phase: z.enum(["start", "result", "error"]),
  id: z.string(),
  name: z.string().optional(),
  args: z.unknown().optional(),
  result: z.unknown().optional(),
  error: z.string().optional(),
  seq: z.number().optional(),
}).passthrough();

export type TranscriptEvent =
  | { kind: "message"; data: z.infer<typeof MessageEventPayload> }
  | { kind: "tool"; phase: "start" | "result" | "error"; data: z.infer<typeof ToolEventPayload> };

export function parseTranscriptEvent(eventName: string, payload: unknown): TranscriptEvent | null {
  if (eventName === "session.message") {
    const p = MessageEventPayload.safeParse(payload);
    return p.success ? { kind: "message", data: p.data } : null;
  }
  if (eventName === "session.tool") {
    const p = ToolEventPayload.safeParse(payload);
    return p.success ? { kind: "tool", phase: p.data.phase, data: p.data } : null;
  }
  return null;
}
```

> If protocol-notes.md from Task 1 reveals different field names for the transcript events, **adjust this schema to match before moving on**. The schema is the source of truth for the adapter.

- [ ] **Step 4: Run, expect PASS** (existing 7 + new 3 = 10)

- [ ] **Step 5: Commit**

```bash
git add lib/openclaw/events.ts lib/openclaw/__tests__/events.test.ts
git commit -m "feat(openclaw): transcript event schemas (session.message, session.tool)"
```

---

## Task 4: Replace `fakeWsServer.ts` with protocol-aware `fakeGateway.ts`

**Files:**
- Create: `lib/openclaw/__tests__/fakeGateway.ts`
- Delete: `lib/openclaw/__tests__/fakeWsServer.ts`
- Modify: any existing tests that imported `fakeWsServer.ts` — they will be replaced by new tests in later tasks. For now, delete the old fixture and the old `client.stream.test.ts` and `client.http.test.ts` files (they're replaced in Task 10).

- [ ] **Step 1: Create `lib/openclaw/__tests__/fakeGateway.ts`**

```ts
import { WebSocketServer, type WebSocket } from "ws";
import type { AddressInfo } from "node:net";

export type FakeGateway = {
  url: string;                        // ws://127.0.0.1:<port>
  httpUrl: string;                    // http://127.0.0.1:<port>
  /** Set a handler invoked once per WS connection AFTER the handshake completes. */
  onClient: (cb: (client: FakeClient) => void) => void;
  close: () => Promise<void>;
};

export type FakeClient = {
  /** Send a server-pushed event frame. */
  emitEvent: (event: string, payload: unknown, opts?: { seq?: number }) => void;
  /** Set a handler for incoming RPC requests. Reply with the returned payload (or throw to signal error). */
  onRequest: (handler: (method: string, params: unknown, id: string) => Promise<{ ok: true; payload?: unknown } | { ok: false; error: { message: string } }>) => void;
  /** Force-close the WS. */
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
              protocol: 3,
              server: { version: "fake", connId: "c1" },
              features: { methods: ["health", "sessions.list", "chat.history", "chat.send", "chat.abort", "sessions.messages.subscribe", "sessions.messages.unsubscribe"], events: ["session.message", "session.tool"] },
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
```

- [ ] **Step 2: Delete the old fixture and orphan test files**

```bash
rm lib/openclaw/__tests__/fakeWsServer.ts
rm lib/openclaw/__tests__/client.http.test.ts
rm lib/openclaw/__tests__/client.stream.test.ts
```

- [ ] **Step 3: Confirm test suite still runs (with reduced count)**

```bash
pnpm test lib/openclaw/
```

The remaining test files (config, events, protocol) should pass — the deleted ones aren't replaced yet (Tasks 5+ will).

- [ ] **Step 4: Commit**

```bash
git add lib/openclaw/__tests__/
git commit -m "test(openclaw): protocol-aware fake gateway fixture"
```

---

## Task 5: `connection.ts` — handshake

**Files:**
- Create: `lib/openclaw/connection.ts`, `lib/openclaw/__tests__/connection.handshake.test.ts`

- [ ] **Step 1: Write failing test** at `lib/openclaw/__tests__/connection.handshake.test.ts`:

```ts
// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from "vitest";
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
});
```

- [ ] **Step 2: Run, expect FAIL**

- [ ] **Step 3: Implement `lib/openclaw/connection.ts`** (handshake portion only — RPC/subscribe come in Tasks 6/7)

```ts
import WebSocket from "ws";
import type { GatewayConfig } from "./config";
import { parseFrame, makeRequest, type Frame } from "./protocol";

type ReadyState = "connecting" | "ready" | "closed" | "error";

export class GatewayConnection {
  private ws: WebSocket | null = null;
  private state: ReadyState = "connecting";
  private readyPromise: Promise<void>;
  private readyResolve!: () => void;
  private readyReject!: (e: Error) => void;
  private connId: string | null = null;

  constructor(private cfg: GatewayConfig) {
    this.readyPromise = new Promise((resolve, reject) => {
      this.readyResolve = resolve;
      this.readyReject = reject;
    });
    this.connect();
  }

  static fromConfig(cfg: GatewayConfig): GatewayConnection {
    return new GatewayConnection(cfg);
  }

  ready(): Promise<void> { return this.readyPromise; }

  private connect() {
    const wsUrl = this.cfg.url.replace(/^http/, "ws") + "/";
    this.ws = new WebSocket(wsUrl);
    this.ws.on("message", (raw) => this.onFrame(raw.toString()));
    this.ws.on("close", () => {
      if (this.state === "connecting") this.readyReject(new Error("closed before handshake"));
      this.state = "closed";
    });
    this.ws.on("error", (e) => {
      if (this.state === "connecting") this.readyReject(e);
      this.state = "error";
    });
  }

  private onFrame(raw: string) {
    let parsed: unknown;
    try { parsed = JSON.parse(raw); } catch { return; }
    const f = parseFrame(parsed);
    if (!f) return;
    if (this.state === "connecting") this.handleHandshakeFrame(f);
  }

  private handleHandshakeFrame(f: Frame) {
    if (f.type === "event" && f.event === "connect.challenge") {
      const req = makeRequest("connect", {
        minProtocol: 3,
        maxProtocol: 3,
        client: { id: "gateway-client", version: "0.1.0", platform: "node", mode: "backend" },
        role: "operator",
        scopes: ["operator.read", "operator.write"],
        caps: [],
        commands: [],
        permissions: {},
        auth: { token: this.cfg.token },
        locale: "en-US",
        userAgent: "clawapp/0.1.0",
      });
      this.connectReqId = req.id;
      this.ws!.send(JSON.stringify(req));
      return;
    }
    if (f.type === "res" && f.id === this.connectReqId) {
      if (f.ok) {
        this.state = "ready";
        this.readyResolve();
      } else {
        this.readyReject(new Error(f.error?.message ?? "handshake failed"));
        this.state = "error";
      }
    }
  }

  private connectReqId: string | null = null;

  async close(): Promise<void> {
    try { this.ws?.close(); } catch { /* ignore */ }
    this.state = "closed";
  }
}
```

- [ ] **Step 4: Run, expect PASS** (2 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/openclaw/connection.ts lib/openclaw/__tests__/connection.handshake.test.ts
git commit -m "feat(openclaw): GatewayConnection handshake"
```

---

## Task 6: `connection.ts` — RPC dispatch

**Files:**
- Modify: `lib/openclaw/connection.ts`
- Create: `lib/openclaw/__tests__/connection.rpc.test.ts`

- [ ] **Step 1: Write failing test** at `lib/openclaw/__tests__/connection.rpc.test.ts`:

```ts
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
      c.onRequest(async (method, params) => {
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
```

- [ ] **Step 2: Run, expect FAIL**

- [ ] **Step 3: Add RPC dispatch to `lib/openclaw/connection.ts`**

Add fields and methods inside `GatewayConnection`:

```ts
// Add to class fields
private pending = new Map<string, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();

// Add new public method (place after ready()):
async invoke(method: string, params: unknown, signal?: AbortSignal): Promise<unknown> {
  if (this.state !== "ready") await this.readyPromise;
  if (this.state !== "ready") throw new Error("connection not ready");
  const req = makeRequest(method, params);
  return new Promise<unknown>((resolve, reject) => {
    this.pending.set(req.id, { resolve, reject });
    if (signal) {
      if (signal.aborted) {
        this.pending.delete(req.id);
        reject(new Error("aborted"));
        return;
      }
      signal.addEventListener("abort", () => {
        if (this.pending.has(req.id)) {
          this.pending.delete(req.id);
          reject(new Error("aborted"));
        }
      }, { once: true });
    }
    try {
      this.ws!.send(JSON.stringify(req));
    } catch (e) {
      this.pending.delete(req.id);
      reject(e as Error);
    }
  });
}
```

Update `onFrame` to handle res frames after handshake:

```ts
private onFrame(raw: string) {
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { return; }
  const f = parseFrame(parsed);
  if (!f) return;
  if (this.state === "connecting") { this.handleHandshakeFrame(f); return; }
  if (f.type === "res") {
    const w = this.pending.get(f.id);
    if (!w) return;
    this.pending.delete(f.id);
    if (f.ok) w.resolve(f.payload);
    else w.reject(new Error(f.error?.message ?? "rpc failed"));
    return;
  }
  // event handling — Task 7
}
```

Update `close()` to reject pending invokes:

```ts
async close(): Promise<void> {
  for (const [, w] of this.pending) w.reject(new Error("connection closed"));
  this.pending.clear();
  try { this.ws?.close(); } catch { /* ignore */ }
  this.state = "closed";
}
```

- [ ] **Step 4: Run, expect PASS** (3 tests; previous 2 still pass — total 5 connection tests)

- [ ] **Step 5: Commit**

```bash
git add lib/openclaw/connection.ts lib/openclaw/__tests__/connection.rpc.test.ts
git commit -m "feat(openclaw): GatewayConnection RPC dispatch with abort support"
```

---

## Task 7: `connection.ts` — subscribe with fan-out

**Files:**
- Modify: `lib/openclaw/connection.ts`
- Create: `lib/openclaw/__tests__/connection.subscribe.test.ts`

- [ ] **Step 1: Write failing test** at `lib/openclaw/__tests__/connection.subscribe.test.ts`:

```ts
// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { startFakeGateway, type FakeGateway, type FakeClient } from "./fakeGateway";
import { GatewayConnection } from "../connection";

let gw: FakeGateway;
let server: FakeClient;

beforeEach(async () => {
  gw = await startFakeGateway();
  gw.onClient((c) => {
    server = c;
    c.onRequest(async (method) => {
      if (method === "sessions.messages.subscribe") return { ok: true, payload: { ok: true } };
      if (method === "sessions.messages.unsubscribe") return { ok: true, payload: { ok: true } };
      return { ok: false, error: { message: "no" } };
    });
  });
});
afterEach(async () => { await gw.close(); });

describe("GatewayConnection.subscribe", () => {
  it("yields events for the subscribed session", async () => {
    const conn = GatewayConnection.fromConfig({ url: gw.httpUrl, token: "t", source: "file" });
    await conn.ready();
    const sub = conn.subscribe("s1");
    // Wait one tick so subscribe round-trip completes
    await new Promise((r) => setTimeout(r, 10));

    const collected: { event: string; seq?: number }[] = [];
    const reader = (async () => {
      for await (const e of sub.events) collected.push(e);
    })();

    server.emitEvent("session.message", { sessionKey: "s1", role: "assistant", text: "hi", seq: 1 }, { seq: 1 });
    server.emitEvent("session.message", { sessionKey: "s1", role: "assistant", text: "!", seq: 2, done: true }, { seq: 2 });
    await new Promise((r) => setTimeout(r, 30));
    await sub.unsubscribe();
    await reader;
    expect(collected.length).toBe(2);
    await conn.close();
  });

  it("fans out events to multiple subscribers of the same session", async () => {
    const conn = GatewayConnection.fromConfig({ url: gw.httpUrl, token: "t", source: "file" });
    await conn.ready();
    const a = conn.subscribe("s1");
    const b = conn.subscribe("s1");
    await new Promise((r) => setTimeout(r, 10));

    const aOut: number[] = []; const bOut: number[] = [];
    const ra = (async () => { for await (const e of a.events) aOut.push(e.seq ?? 0); })();
    const rb = (async () => { for await (const e of b.events) bOut.push(e.seq ?? 0); })();

    server.emitEvent("session.message", { sessionKey: "s1", role: "assistant", text: "x", seq: 1 }, { seq: 1 });
    await new Promise((r) => setTimeout(r, 30));
    await a.unsubscribe(); await b.unsubscribe();
    await Promise.all([ra, rb]);
    expect(aOut).toEqual([1]);
    expect(bOut).toEqual([1]);
    await conn.close();
  });
});
```

- [ ] **Step 2: Run, expect FAIL**

- [ ] **Step 3: Add subscription support to `lib/openclaw/connection.ts`**

Add fields:

```ts
// Subscriptions: sessionKey → set of queues + refcount
type Queue = {
  push: (e: { event: string; payload: unknown; seq?: number }) => void;
  end: () => void;
};
private subs = new Map<string, { queues: Set<Queue>; refcount: number }>();
```

Add `subscribe`:

```ts
subscribe(sessionKey: string): {
  events: AsyncIterable<{ event: string; payload: unknown; seq?: number }>;
  unsubscribe: () => Promise<void>;
} {
  const queueBuf: { event: string; payload: unknown; seq?: number }[] = [];
  let waiter: ((v: void) => void) | null = null;
  let ended = false;
  const queue: Queue = {
    push: (e) => { queueBuf.push(e); waiter?.(); waiter = null; },
    end: () => { ended = true; waiter?.(); waiter = null; },
  };

  const events = (async function* () {
    while (true) {
      while (queueBuf.length) yield queueBuf.shift()!;
      if (ended) return;
      await new Promise<void>((res) => { waiter = res; });
    }
  })();

  let entry = this.subs.get(sessionKey);
  if (!entry) {
    entry = { queues: new Set(), refcount: 0 };
    this.subs.set(sessionKey, entry);
  }
  entry.queues.add(queue);
  entry.refcount++;

  // First subscriber sends the upstream subscribe req
  const initPromise = entry.refcount === 1
    ? this.invoke("sessions.messages.subscribe", { sessionKey }).catch(() => undefined)
    : Promise.resolve();

  const unsubscribe = async () => {
    queue.end();
    entry!.queues.delete(queue);
    entry!.refcount--;
    if (entry!.refcount === 0) {
      this.subs.delete(sessionKey);
      await this.invoke("sessions.messages.unsubscribe", { sessionKey }).catch(() => undefined);
    }
  };

  // Make sure subscribe req has been sent before yielding
  const guardedEvents = (async function* () {
    await initPromise;
    for await (const e of events) yield e;
  })();

  return { events: guardedEvents, unsubscribe };
}
```

Extend `onFrame` event handling:

```ts
// inside onFrame, after the res-frame block:
if (f.type === "event") {
  const sessionKey = (f.payload as { sessionKey?: string } | null | undefined)?.sessionKey;
  if (!sessionKey) return;  // ignore non-session events for now
  const entry = this.subs.get(sessionKey);
  if (!entry) return;
  for (const q of entry.queues) q.push({ event: f.event, payload: f.payload, seq: f.seq });
  return;
}
```

Update `close()` to end all subscription queues:

```ts
async close(): Promise<void> {
  for (const [, entry] of this.subs) for (const q of entry.queues) q.end();
  this.subs.clear();
  for (const [, w] of this.pending) w.reject(new Error("connection closed"));
  this.pending.clear();
  try { this.ws?.close(); } catch { /* ignore */ }
  this.state = "closed";
}
```

- [ ] **Step 4: Run, expect PASS** (2 new tests, all prior tests still pass)

- [ ] **Step 5: Commit**

```bash
git add lib/openclaw/connection.ts lib/openclaw/__tests__/connection.subscribe.test.ts
git commit -m "feat(openclaw): GatewayConnection subscribe with fan-out"
```

---

## Task 8: `connection.ts` — reconnect with backoff and re-subscribe

**Files:**
- Modify: `lib/openclaw/connection.ts`
- Create: `lib/openclaw/__tests__/connection.reconnect.test.ts`

- [ ] **Step 1: Write failing test** at `lib/openclaw/__tests__/connection.reconnect.test.ts`:

```ts
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
    gw.onClient((c) => {
      count++;
      if (count === 1) firstClient = c;
      if (count === 2) secondClient = c;
      c.onRequest(async (method) => {
        if (method === "sessions.messages.subscribe") return { ok: true, payload: { ok: true } };
        if (method === "sessions.messages.unsubscribe") return { ok: true, payload: { ok: true } };
        return { ok: false, error: { message: "no" } };
      });
    });

    const conn = GatewayConnection.fromConfig({ url: gw.httpUrl, token: "t", source: "file" });
    await conn.ready();
    const sub = conn.subscribe("s1");
    await new Promise((r) => setTimeout(r, 20));

    const collected: number[] = [];
    const reader = (async () => {
      for await (const e of sub.events) collected.push(e.seq ?? 0);
    })();

    firstClient.emitEvent("session.message", { sessionKey: "s1", role: "assistant", text: "a", seq: 1 }, { seq: 1 });
    await new Promise((r) => setTimeout(r, 30));

    // Drop the first connection
    firstClient.close();
    // Wait for reconnect (backoff initial 250ms, then handshake)
    await new Promise((r) => setTimeout(r, 1500));

    expect(count).toBeGreaterThanOrEqual(2);
    secondClient.emitEvent("session.message", { sessionKey: "s1", role: "assistant", text: "b", seq: 2 }, { seq: 2 });
    await new Promise((r) => setTimeout(r, 50));
    await sub.unsubscribe();
    await reader;
    expect(collected).toEqual([1, 2]);
    await conn.close();
  });
});
```

- [ ] **Step 2: Run, expect FAIL**

- [ ] **Step 3: Add reconnect logic to `lib/openclaw/connection.ts`**

Track active subscriptions for re-issue. Modify `connect()` and add reconnection:

```ts
// Add field:
private backoffMs = 250;
private maxBackoffMs = 8000;
private closing = false;

// Modify connect() to schedule reconnects on close while not deliberately closing:
private connect() {
  this.state = "connecting";
  // Reset readyPromise on reconnect so callers can `await ready()` again if needed.
  this.readyPromise = new Promise((resolve, reject) => {
    this.readyResolve = resolve;
    this.readyReject = reject;
  });
  const wsUrl = this.cfg.url.replace(/^http/, "ws") + "/";
  this.ws = new WebSocket(wsUrl);
  this.ws.on("message", (raw) => this.onFrame(raw.toString()));
  this.ws.on("close", () => this.onClose());
  this.ws.on("error", () => { /* close will follow */ });
}

private onClose() {
  if (this.state === "connecting") {
    this.readyReject(new Error("closed before handshake"));
  }
  this.state = "closed";
  // Reject in-flight invokes
  for (const [, w] of this.pending) w.reject(new Error("transport-reset"));
  this.pending.clear();
  if (this.closing) return;
  // Schedule reconnect
  setTimeout(() => this.reconnect(), this.backoffMs);
  this.backoffMs = Math.min(this.backoffMs * 2, this.maxBackoffMs);
}

private async reconnect() {
  if (this.closing) return;
  this.connect();
  try {
    await this.readyPromise;
    this.backoffMs = 250;
    // Re-issue all active subscriptions
    for (const sessionKey of this.subs.keys()) {
      this.invoke("sessions.messages.subscribe", { sessionKey }).catch(() => undefined);
    }
  } catch {
    // onClose will reschedule
  }
}

// Update close() to set the closing flag:
async close(): Promise<void> {
  this.closing = true;
  for (const [, entry] of this.subs) for (const q of entry.queues) q.end();
  this.subs.clear();
  for (const [, w] of this.pending) w.reject(new Error("connection closed"));
  this.pending.clear();
  try { this.ws?.close(); } catch { /* ignore */ }
  this.state = "closed";
}
```

> Note: this test relies on real timers (250ms backoff). Don't use `vi.useFakeTimers()` here — the WS message round-trips need real time to flow.

- [ ] **Step 4: Run, expect PASS**

- [ ] **Step 5: Commit**

```bash
git add lib/openclaw/connection.ts lib/openclaw/__tests__/connection.reconnect.test.ts
git commit -m "feat(openclaw): GatewayConnection reconnect with re-subscribe"
```

---

## Task 9: `adapter.ts` — TranscriptEvent → StreamEvent reducer

**Files:**
- Create: `lib/openclaw/adapter.ts`, `lib/openclaw/__tests__/adapter.test.ts`

- [ ] **Step 1: Write failing test** at `lib/openclaw/__tests__/adapter.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { adaptTranscriptEvent, initialAdapterState } from "../adapter";
import type { TranscriptEvent } from "../events";

function run(events: { name: string; payload: unknown }[]): unknown[] {
  let state = initialAdapterState();
  const out: unknown[] = [];
  for (const e of events) {
    // Reuse parseTranscriptEvent indirectly — for the table-driven test we feed
    // already-typed TranscriptEvent values:
    const te = e as unknown as TranscriptEvent;
    const r = adaptTranscriptEvent(te, state);
    out.push(...r.out);
    state = r.next;
  }
  return out;
}

describe("adapter.adaptTranscriptEvent", () => {
  it("maps assistant text deltas to token events", () => {
    const events: TranscriptEvent[] = [
      { kind: "message", data: { sessionKey: "s", role: "assistant", text: "hi", seq: 1 } as never },
      { kind: "message", data: { sessionKey: "s", role: "assistant", delta: " there", seq: 2 } as never },
    ];
    const out = run(events as never);
    expect(out).toEqual([
      { type: "token", text: "hi" },
      { type: "token", text: " there" },
    ]);
  });

  it("maps tool start/result to tool_call/tool_result", () => {
    const events: TranscriptEvent[] = [
      { kind: "tool", phase: "start", data: { sessionKey: "s", phase: "start", id: "t1", name: "search", args: { q: "x" } } as never },
      { kind: "tool", phase: "result", data: { sessionKey: "s", phase: "result", id: "t1", result: "ok" } as never },
    ];
    const out = run(events as never);
    expect(out).toEqual([
      { type: "tool_call", id: "t1", name: "search", args: { q: "x" } },
      { type: "tool_result", id: "t1", result: "ok" },
    ]);
  });

  it("maps thinking-role messages to thinking events", () => {
    const events: TranscriptEvent[] = [
      { kind: "message", data: { sessionKey: "s", role: "thinking", text: "hmm", seq: 1 } as never },
    ];
    const out = run(events as never);
    expect(out).toEqual([{ type: "thinking", text: "hmm" }]);
  });

  it("emits done when message has done:true", () => {
    const events: TranscriptEvent[] = [
      { kind: "message", data: { sessionKey: "s", role: "assistant", text: "x", seq: 1, done: true } as never },
    ];
    const out = run(events as never);
    expect(out).toEqual([
      { type: "token", text: "x" },
      { type: "done" },
    ]);
  });

  it("dedupes events by seq <= baseline (set via initialAdapterState)", () => {
    const events: TranscriptEvent[] = [
      { kind: "message", data: { sessionKey: "s", role: "assistant", text: "old", seq: 5 } as never },
      { kind: "message", data: { sessionKey: "s", role: "assistant", text: "new", seq: 6 } as never },
    ];
    let state = initialAdapterState({ baselineSeq: 5 });
    const out: unknown[] = [];
    for (const e of events) {
      const r = adaptTranscriptEvent(e, state);
      out.push(...r.out);
      state = r.next;
    }
    expect(out).toEqual([{ type: "token", text: "new" }]);
  });
});
```

- [ ] **Step 2: Run, expect FAIL**

- [ ] **Step 3: Implement `lib/openclaw/adapter.ts`**

```ts
import type { StreamEvent } from "./events";
import type { TranscriptEvent } from "./events";

export type AdapterState = {
  baselineSeq: number;
  lastSeq: number;
};

export function initialAdapterState(opts?: { baselineSeq?: number }): AdapterState {
  return { baselineSeq: opts?.baselineSeq ?? -1, lastSeq: opts?.baselineSeq ?? -1 };
}

export function adaptTranscriptEvent(
  ev: TranscriptEvent,
  state: AdapterState,
): { out: StreamEvent[]; next: AdapterState } {
  // Filter out backfilled events (seq <= baseline)
  const seq = (ev.kind === "message" ? ev.data.seq : ev.data.seq) ?? state.lastSeq + 1;
  if (typeof seq === "number" && seq <= state.baselineSeq) {
    return { out: [], next: state };
  }
  const next: AdapterState = { ...state, lastSeq: Math.max(state.lastSeq, typeof seq === "number" ? seq : state.lastSeq) };

  if (ev.kind === "message") {
    const role = ev.data.role;
    const text = ev.data.text ?? ev.data.delta ?? "";
    const done = ev.data.done === true;
    const out: StreamEvent[] = [];
    if (role === "thinking" && text.length > 0) out.push({ type: "thinking", text });
    else if ((role === "assistant" || role === "user" || role === "system") && text.length > 0) {
      // Only assistant tokens are interesting for streaming UI; user/system echoes are skipped.
      if (role === "assistant") out.push({ type: "token", text });
    }
    if (done) out.push({ type: "done" });
    return { out, next };
  }

  // tool
  if (ev.phase === "start") {
    return {
      out: [{ type: "tool_call", id: ev.data.id, name: ev.data.name ?? "", args: ev.data.args }],
      next,
    };
  }
  if (ev.phase === "result") {
    return {
      out: [{ type: "tool_result", id: ev.data.id, result: ev.data.result }],
      next,
    };
  }
  // error phase
  return {
    out: [{ type: "tool_result", id: ev.data.id, result: undefined, error: ev.data.error ?? "tool error" }],
    next,
  };
}
```

> The shape of `StreamEvent` `tool_result` was defined in v1 as `{type:"tool_result", id, result, error?}`. Verify this matches `lib/openclaw/events.ts` v1 and adjust if needed.

- [ ] **Step 4: Run, expect PASS** (5 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/openclaw/adapter.ts lib/openclaw/__tests__/adapter.test.ts
git commit -m "feat(openclaw): transcript-event → stream-event adapter (pure reducer)"
```

---

## Task 10: Rewrite `client.ts` against `GatewayConnection`

**Files:**
- Modify: `lib/openclaw/client.ts`
- Create: `lib/openclaw/__tests__/client.test.ts`

- [ ] **Step 1: Write failing test** at `lib/openclaw/__tests__/client.test.ts`:

```ts
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
    c.onRequest(async (method) => {
      switch (method) {
        case "sessions.list": return { ok: true, payload: { sessions: [{ id: "s1", title: "T" }] } };
        case "chat.history":  return { ok: true, payload: { messages: [{ role: "user", text: "hi", at: 1 }] } };
        case "health":        return { ok: true, payload: { ok: true } };
        case "sessions.messages.subscribe":
        case "sessions.messages.unsubscribe":
                              return { ok: true, payload: { ok: true } };
        case "chat.send":     return { ok: true, payload: { ok: true } };
        case "chat.abort":    return { ok: true, payload: { ok: true } };
        default: return { ok: false, error: { message: "no" } };
      }
    });
  });
});
afterEach(async () => { await gw.close(); });

describe("createClient", () => {
  it("listSessions returns sessions array", async () => {
    const conn = GatewayConnection.fromConfig({ url: gw.httpUrl, token: "t", source: "file" });
    await conn.ready();
    const c = createClient(conn);
    expect(await c.listSessions()).toEqual([{ id: "s1", title: "T" }]);
    await conn.close();
  });

  it("getHistory returns messages array", async () => {
    const conn = GatewayConnection.fromConfig({ url: gw.httpUrl, token: "t", source: "file" });
    await conn.ready();
    const c = createClient(conn);
    expect(await c.getHistory("s1")).toEqual([{ role: "user", text: "hi", at: 1 }]);
    await conn.close();
  });

  it("health returns ok:true", async () => {
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

    // Drive events from the server side AFTER the test calls sendMessage and the subscribe res lands.
    queueMicrotask(() => setTimeout(() => {
      server.emitEvent("session.message", { sessionKey: "s1", role: "assistant", text: "hello ", seq: 1 }, { seq: 1 });
      server.emitEvent("session.tool", { sessionKey: "s1", phase: "start", id: "t1", name: "search", args: {} }, { seq: 2 });
      server.emitEvent("session.tool", { sessionKey: "s1", phase: "result", id: "t1", result: "ok" }, { seq: 3 });
      server.emitEvent("session.message", { sessionKey: "s1", role: "assistant", text: "world", seq: 4, done: true }, { seq: 4 });
    }, 30));

    const out: unknown[] = [];
    for await (const e of c.sendMessage("s1", "hi")) out.push(e);
    expect(out).toContainEqual({ type: "token", text: "hello " });
    expect(out).toContainEqual({ type: "tool_call", id: "t1", name: "search", args: {} });
    expect(out).toContainEqual({ type: "tool_result", id: "t1", result: "ok" });
    expect(out).toContainEqual({ type: "token", text: "world" });
    expect(out).toContainEqual({ type: "done" });
    await conn.close();
  });
});
```

- [ ] **Step 2: Run, expect FAIL**

- [ ] **Step 3: Rewrite `lib/openclaw/client.ts`**

Replace the entire file contents with:

```ts
import type { StreamEvent, TranscriptEvent } from "./events";
import { parseTranscriptEvent } from "./events";
import { adaptTranscriptEvent, initialAdapterState } from "./adapter";
import type { GatewayConnection } from "./connection";

export type SessionSummary = { id: string; title: string };
export type Message = { role: "user" | "assistant" | "system"; text: string; at: number };

export type Client = {
  listSessions(): Promise<SessionSummary[]>;
  getHistory(sessionKey: string): Promise<Message[]>;
  health(): Promise<{ ok: boolean; reason?: string }>;
  sendMessage(sessionKey: string, text: string, signal?: AbortSignal): AsyncIterable<StreamEvent>;
};

export function createClient(conn: GatewayConnection): Client {
  async function listSessions(): Promise<SessionSummary[]> {
    const p = await conn.invoke("sessions.list", {}) as { sessions?: { id?: string; key?: string; title?: string }[] };
    return (p?.sessions ?? []).map((s) => ({ id: s.id ?? s.key ?? "", title: s.title ?? "" }));
  }

  async function getHistory(sessionKey: string): Promise<Message[]> {
    const p = await conn.invoke("chat.history", { sessionKey }) as { messages?: Message[] };
    return p?.messages ?? [];
  }

  async function health(): Promise<{ ok: boolean; reason?: string }> {
    try {
      await conn.invoke("health", {});
      return { ok: true };
    } catch (e) {
      return { ok: false, reason: (e as Error).message };
    }
  }

  async function* sendMessage(
    sessionKey: string,
    text: string,
    signal?: AbortSignal,
  ): AsyncIterable<StreamEvent> {
    const sub = conn.subscribe(sessionKey);
    let state = initialAdapterState();
    let aborted = false;

    if (signal) {
      if (signal.aborted) {
        await sub.unsubscribe();
        yield { type: "error", message: "aborted" };
        return;
      }
      signal.addEventListener("abort", () => {
        aborted = true;
        conn.invoke("chat.abort", { sessionKey }).catch(() => undefined);
      }, { once: true });
    }

    // Fire chat.send concurrently — don't await
    const sendPromise = conn.invoke("chat.send", { sessionKey, text }).catch((e: Error) => ({ __error: e.message }));

    let sendDone = false;
    sendPromise.then((r) => {
      sendDone = true;
      if (r && typeof r === "object" && "__error" in r) {
        // Error will be surfaced via terminal yield below.
      }
    });

    try {
      for await (const ev of sub.events) {
        if (aborted) {
          yield { type: "error", message: "aborted" };
          return;
        }
        const te: TranscriptEvent | null = parseTranscriptEvent(ev.event, ev.payload);
        if (!te) continue;
        const r = adaptTranscriptEvent(te, state);
        state = r.next;
        for (const out of r.out) {
          yield out;
          if (out.type === "done" || out.type === "error") return;
        }
        // If chat.send already returned and we've drained queued events, exit the loop.
        // (Heuristic: if sendDone and no more pending events for a tick, stop.)
      }
      if (!sendDone) await sendPromise;
      const r = await sendPromise;
      if (r && typeof r === "object" && "__error" in r) {
        yield { type: "error", message: (r as { __error: string }).__error };
      }
    } finally {
      await sub.unsubscribe();
    }
  }

  return { listSessions, getHistory, health, sendMessage };
}
```

> The `sendMessage` loop ends naturally when the adapter emits a `done` event. If openclaw doesn't emit a `done` flag and only signals turn-completion via the `chat.send` response, the loop won't exit on its own. **Verify against the running gateway** (Task 1 notes). If needed, augment the loop to also exit when `sendDone` becomes true AND a short idle window has elapsed. Do this only if integration testing shows the issue.

- [ ] **Step 4: Run, expect PASS** (4 tests)

- [ ] **Step 5: Run full v1 suite to confirm no regression in unrelated areas**

```bash
pnpm test
pnpm typecheck
```

- [ ] **Step 6: Commit**

```bash
git add lib/openclaw/client.ts lib/openclaw/__tests__/client.test.ts
git commit -m "feat(openclaw): rewrite client against GatewayConnection (WS protocol)"
```

---

## Task 11: Update `lib/openclaw/index.ts` to wire connection

**Files:**
- Modify: `lib/openclaw/index.ts`

- [ ] **Step 1: Replace contents of `lib/openclaw/index.ts`**

```ts
import { loadConfig } from "./config";
import { createClient, type Client } from "./client";
import { GatewayConnection } from "./connection";

let cachedClient: Client | null = null;
let cachedConnection: GatewayConnection | null = null;

export function getClient(): Client | null {
  if (cachedClient) return cachedClient;
  const cfg = loadConfig();
  if (!cfg) return null;
  cachedConnection = GatewayConnection.fromConfig(cfg);
  cachedClient = createClient(cachedConnection);
  return cachedClient;
}

export function __resetClientForTests() {
  if (cachedConnection) { cachedConnection.close().catch(() => undefined); cachedConnection = null; }
  cachedClient = null;
}

export type { SessionSummary, Message } from "./client";
export type { StreamEvent } from "./events";
```

> Note: The `health()` route currently calls `getClient()?.health()`. The `health()` implementation in client.ts now triggers a real RPC. When the gateway is unreachable, `GatewayConnection.fromConfig` succeeds (constructor returns synchronously) but the WS will fail to open and `invoke` will reject. That bubbles up as `{ok: false, reason: ...}` — exactly what the StatusBanner expects.

- [ ] **Step 2: Run typecheck and full test suite**

```bash
pnpm typecheck
pnpm test
```

The route tests (e.g. `app/api/health/route.test.ts`) mock at the `Client` level so they should still pass.

- [ ] **Step 3: Commit**

```bash
git add lib/openclaw/index.ts
git commit -m "feat(openclaw): wire singleton through GatewayConnection"
```

---

## Task 12: Rewrite `e2e/fixtures/gateway.ts` to speak the real protocol

**Files:**
- Modify: `e2e/fixtures/gateway.ts`

- [ ] **Step 1: Replace** `e2e/fixtures/gateway.ts`:

```ts
import http from "node:http";
import { WebSocketServer } from "ws";

export async function startFakeGateway(port: number, token: string) {
  const server = http.createServer((_req, res) => { res.statusCode = 404; res.end(); });
  const wss = new WebSocketServer({ server });

  wss.on("connection", (ws) => {
    let connected = false;
    let connectId: string | null = null;

    ws.send(JSON.stringify({
      type: "event", event: "connect.challenge", payload: { nonce: "n", ts: Date.now() },
    }));

    ws.on("message", async (raw) => {
      let f: { type?: string; id?: string; method?: string; params?: unknown };
      try { f = JSON.parse(String(raw)); } catch { return; }

      if (!connected && f.type === "req" && f.method === "connect") {
        const t = (f.params as { auth?: { token?: string } } | undefined)?.auth?.token;
        if (t !== token) {
          ws.send(JSON.stringify({ type: "res", id: f.id, ok: false, error: { message: "bad-token" } }));
          ws.close();
          return;
        }
        connectId = f.id ?? null;
        ws.send(JSON.stringify({
          type: "res", id: f.id, ok: true,
          payload: {
            type: "hello-ok", protocol: 3,
            server: { version: "fake", connId: "c1" },
            features: { methods: [], events: ["session.message", "session.tool"] },
            snapshot: {},
            policy: { maxPayload: 1_048_576, maxBufferedBytes: 1_048_576, tickIntervalMs: 30_000 },
            auth: { role: "operator", scopes: ["operator.read", "operator.write"] },
          },
        }));
        connected = true;
        return;
      }

      if (!connected) return;
      void connectId;

      if (f.type !== "req") return;

      if (f.method === "sessions.list") {
        ws.send(JSON.stringify({ type: "res", id: f.id, ok: true, payload: { sessions: [{ id: "s1", title: "Test" }] } }));
        return;
      }
      if (f.method === "chat.history") {
        ws.send(JSON.stringify({ type: "res", id: f.id, ok: true, payload: { messages: [] } }));
        return;
      }
      if (f.method === "health") {
        ws.send(JSON.stringify({ type: "res", id: f.id, ok: true, payload: { ok: true } }));
        return;
      }
      if (f.method === "sessions.messages.subscribe" || f.method === "sessions.messages.unsubscribe") {
        ws.send(JSON.stringify({ type: "res", id: f.id, ok: true, payload: { ok: true } }));
        return;
      }
      if (f.method === "chat.send") {
        ws.send(JSON.stringify({ type: "res", id: f.id, ok: true, payload: { ok: true } }));
        const sessionKey = (f.params as { sessionKey?: string } | undefined)?.sessionKey ?? "s1";
        // Simulate streamed agent output
        setTimeout(() => {
          ws.send(JSON.stringify({ type: "event", event: "session.message", payload: { sessionKey, role: "assistant", text: "hello ", seq: 1 }, seq: 1 }));
          ws.send(JSON.stringify({ type: "event", event: "session.tool", payload: { sessionKey, phase: "start", id: "t1", name: "search", args: { q: "x" } }, seq: 2 }));
          ws.send(JSON.stringify({ type: "event", event: "session.tool", payload: { sessionKey, phase: "result", id: "t1", result: "ok" }, seq: 3 }));
          ws.send(JSON.stringify({ type: "event", event: "session.message", payload: { sessionKey, role: "assistant", text: "world", seq: 4, done: true }, seq: 4 }));
        }, 50);
        return;
      }
      if (f.method === "chat.abort") {
        ws.send(JSON.stringify({ type: "res", id: f.id, ok: true, payload: { ok: true } }));
        return;
      }
      ws.send(JSON.stringify({ type: "res", id: f.id, ok: false, error: { message: "method not implemented in fake" } }));
    });
  });

  await new Promise<void>((res) => server.listen(port, "127.0.0.1", () => res()));
  return () => new Promise<void>((res) => server.close(() => res()));
}
```

- [ ] **Step 2: Run e2e**

```bash
pnpm test:e2e
```

The Playwright assertions (`/hello/`, `/world/`, `search`) stay the same. If the test fails because the real connection takes longer to establish than v1, raise the relevant `toBeVisible` timeouts to 15s.

- [ ] **Step 3: Commit**

```bash
git add e2e/fixtures/gateway.ts
git commit -m "test(e2e): fake gateway speaks the real openclaw protocol"
```

---

## Task 13: Manual integration verification against the real gateway

**Files:** none (verification + notes)

This task does NOT add code — it verifies the implementation against the user's real openclaw install and captures any drift in `docs/openclaw-protocol-notes.md`.

- [ ] **Step 1: Confirm openclaw is running**

```bash
TOKEN=$(python3 -c "import json; print(json.load(open('/Users/panda/.openclaw/openclaw.json'))['gateway']['auth']['token'])")
/usr/bin/curl -sS -m 3 -o /dev/null -w "HTTP %{http_code}\n" -H "Authorization: Bearer $TOKEN" http://127.0.0.1:18789/
```

If non-200, ask the user to start openclaw before continuing.

- [ ] **Step 2: Start the dev server**

```bash
pnpm dev
```

- [ ] **Step 3: Open http://localhost:3000 (or the assigned port) and:**

1. Verify the sessions sidebar populates from your real openclaw sessions (no empty list).
2. Send a short message ("hi"). Watch tokens stream into the assistant message.
3. If a tool fires, verify the tool-call panel renders with the tool name and result.
4. If thinking is enabled, verify a "Thinking…" panel appears.

- [ ] **Step 4: Capture any anomalies**

If any of the following happens, append a note to `docs/openclaw-protocol-notes.md` and FIX it in `lib/openclaw/adapter.ts` (the only place that should change):

- Sessions list returns rows with different field names than `id`/`title`.
- Tokens never appear (only finalized messages).
- Tool events use different `phase` strings.
- A turn never emits `done:true` (chat hangs after agent finishes).

For the "no done flag" case, modify `client.sendMessage` to also exit when `sendPromise` resolves AND ~500ms of stream idleness has elapsed:

```ts
// In sendMessage, after the for-await loop, replace the post-loop logic with:
let lastEventAt = Date.now();
// ... track lastEventAt = Date.now() inside the loop after each yield ...
// After the loop body, if sendDone && Date.now() - lastEventAt > 500, return.
```

- [ ] **Step 5: Run the full test suite one more time**

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm build && pnpm test:e2e
```

All must pass.

- [ ] **Step 6: Commit any adapter/notes changes (if needed)**

```bash
git add lib/openclaw/adapter.ts docs/openclaw-protocol-notes.md
git commit -m "fix(openclaw): adapter adjustments from live gateway integration"
```

If no changes were needed, no commit. Move on.

---

## Task 14: Update README and final pass

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update README.md** — replace the v1 description with v1.1 specifics:

Add a new section after `## Run`:

```markdown
## How it talks to openclaw

Connects via openclaw's gateway WebSocket protocol at `ws://127.0.0.1:18789/` using your bearer token from `~/.openclaw/openclaw.json`. The connection is established once at server boot, identifies as a trusted backend client (no device pairing required on loopback), and multiplexes all RPCs and per-session subscriptions over the same socket. See [docs/openclaw-protocol-notes.md](docs/openclaw-protocol-notes.md) for the protocol map.
```

- [ ] **Step 2: Run all checks one more time**

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm build
```

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: README — describe gateway WS integration"
```

---

## Notes for the implementer

- **The `Client` public surface is the contract.** Frontend, hooks, route handlers, and components must NOT change in this plan. If you find yourself editing `useChat.ts` or any component, stop — you're going outside scope.
- **Adapter is the only "soft" file.** When integration reveals shape drift, fix `adapter.ts`. Don't sprinkle adjustments across `connection.ts`, `client.ts`, or `events.ts`.
- **Don't add reconnect tests for the e2e fixture.** Reconnect is unit-tested; e2e covers the happy path.
- **Frame validation should never crash the connection.** Unknown event names and malformed payloads must be silently dropped so a single bad frame doesn't take the chat down.
