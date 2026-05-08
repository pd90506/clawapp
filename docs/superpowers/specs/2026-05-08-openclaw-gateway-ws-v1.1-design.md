# clawapp v1.1 — real openclaw gateway integration (WS protocol)

**Status:** design approved 2026-05-08
**Scope:** v1.1 only. Replaces v1's REST/WS guesses with the actual openclaw gateway WebSocket protocol. Frontend unchanged.

## Context

v1 (branch `feat/v1-chat-app`) shipped a chat-first frontend that assumed a REST + standalone-WS gateway shape. That assumption was wrong. The real openclaw gateway speaks a **single typed WebSocket protocol** at `ws://127.0.0.1:18789/`, with a mandatory `connect` handshake. v1 is internally consistent and well-tested against a fake gateway, but cannot talk to a real openclaw install. v1.1 fixes that without changing the user's `~/.openclaw/openclaw.json`.

## Goal

Make the v1 frontend talk to a real openclaw gateway. End user sends a message in the chat UI; tokens stream into the assistant message; tool-call panels and thinking blocks render in real time; sessions sidebar lists actual openclaw sessions.

## Non-goals (v1.1)

- Configuration UI.
- Local persistence (history still re-fetched from openclaw).
- Multi-user / remote deployment.
- The OpenAI-compatible `/v1/*` endpoints (require user config edits).
- The `/tools/invoke` HTTP path (`sessions.send`-style is denied by default; doesn't fit chat-streaming UX).
- Modifying any file under `~/.openclaw/`.

## Protocol facts (locked at design time)

From `/opt/homebrew/lib/node_modules/openclaw/docs/gateway/protocol.md`:

- Transport: WebSocket, JSON text frames. Frame types: `req`, `res`, `event`.
- First frame must be `connect`. Pre-connect frames capped at 64 KiB.
- Auth path for our case: **trusted same-process backend client.** `client.id: "gateway-client"`, `client.mode: "backend"`, `auth.token: <bearer>`, `device` omitted. Direct loopback only. Gets full operator scopes from shared-secret auth.
- Handshake exchange:
  - Server pushes `event: connect.challenge` with `nonce` + `ts`.
  - Client sends `req: connect` (see params shape in protocol.md).
  - Server replies `res: hello-ok` with `protocol`, `server`, `features.methods`, `policy.maxPayload`, etc.
- Method dispatch: each `req` carries a unique `id`; the matching `res` echoes the same `id` with `ok: true|false`.
- Server-pushed events (post-handshake) are unsolicited frames: `{type: "event", event, payload, seq?, stateVersion?}`. Subscriptions gate which events the server pushes for this connection.

Methods we will use:

| Method | Purpose |
|---|---|
| `connect` | Handshake (mandatory) |
| `health` | Cached gateway health snapshot |
| `sessions.list` | Session index for the sidebar |
| `chat.history` | Display-normalized transcript for one session |
| `sessions.messages.subscribe` / `sessions.messages.unsubscribe` | Toggle transcript event subscription for one session |
| `chat.send` | Send a user message into a session |
| `chat.abort` | Abort an in-flight chat run |

Events we will consume:

- `session.message` — incremental assistant message updates and finalized rows.
- `session.tool` — tool-call lifecycle (start, result, error).
- `chat` family — `chat.inject` and similar transcript events.

Verification of exact event payloads and `chat.send`'s response semantics (does it return after the run completes, or immediately?) happens at integration time by reading `node_modules/openclaw/dist/gateway/protocol/index.js` and observing live frames from openclaw's bundled control-ui. Adapter logic lives in one place (`client.ts`) so the rest of the app is insulated.

## Architecture

```
Browser (unchanged)
   │  fetch (JSON) + POST + SSE reader
   ▼
Next.js server routes (mostly unchanged)
   │  Client.listSessions() / getHistory() / sendMessage()
   ▼
lib/openclaw/client.ts  (rewritten)
   │  RPC: invoke(method, params) → Promise<payload>
   │  Subscriptions: subscribe(sessionKey) → AsyncIterable<TranscriptEvent>
   ▼
lib/openclaw/connection.ts  (new)
   │  one persistent WS, connect-handshake, id-correlated dispatch,
   │  fan-out of subscribed events, reconnect with backoff
   ▼
ws://127.0.0.1:18789/  (single multiplex WS to openclaw)
```

The browser-to-server hop is unchanged: SSE on `/api/chat`, JSON on `/api/sessions` and `/api/health`. Only the server↔gateway hop changes.

## Modules

### `lib/openclaw/connection.ts` (new)

A `GatewayConnection` class. One instance per server process. Lazy-created on first call to `getClient()`.

Responsibilities:

- Open WS, wait for `event: connect.challenge`, send `req: connect` with backend identity + token, parse `hello-ok`, transition to ready.
- `invoke(method, params): Promise<payload>` — generates an id, sends a `req`, resolves on the matching `res`. Rejects on transport error or `res.ok: false`. Honors a `signal?: AbortSignal` to cancel pending invokes.
- `subscribe(sessionKey): AsyncIterable<TranscriptEvent> & { unsubscribe(): Promise<void> }` — calls `sessions.messages.subscribe`, registers an event sink, yields events until unsubscribe or close. Multiple subscribers per session are fanned out from a single underlying subscription (refcounted).
- Reconnect: exponential backoff (250ms → 8s, capped). On reconnect, re-issue all active subscriptions transparently. In-flight invokes that were sent before the disconnect reject with `{type: "transport-reset"}` so callers can decide whether to retry.
- Heartbeat awareness: reads `policy.tickIntervalMs` from `hello-ok`; if no event seen in 2× tickInterval, treats as dead and reconnects.

Surface used by `client.ts`:

```ts
export class GatewayConnection {
  static fromConfig(cfg: GatewayConfig): GatewayConnection;
  ready(): Promise<void>;
  invoke(method: string, params: unknown, signal?: AbortSignal): Promise<unknown>;
  subscribe(sessionKey: string): { events: AsyncIterable<TranscriptEvent>; unsubscribe: () => Promise<void> };
  close(): Promise<void>;
}
```

`TranscriptEvent` is a typed union of openclaw's `session.message` / `session.tool` event shapes (zod-validated).

### `lib/openclaw/client.ts` (rewritten)

Public `Client` type and method signatures are unchanged from v1:

```ts
export type Client = {
  listSessions(): Promise<SessionSummary[]>;
  getHistory(sessionKey: string): Promise<Message[]>;
  health(): Promise<{ ok: boolean; reason?: string }>;
  sendMessage(sessionKey: string, text: string, signal?: AbortSignal): AsyncIterable<StreamEvent>;
};
```

Implementation maps each method to one or more gateway calls:

- `listSessions()` → `invoke("sessions.list", {})`. Map gateway rows to `SessionSummary {id, title}`.
- `getHistory(sessionKey)` → `invoke("chat.history", {sessionKey})`. Map to v1 `Message`.
- `health()` → `invoke("health", {})` with a short timeout; return `{ok: true}` on success, `{ok: false, reason}` on failure or transport error.
- `sendMessage(sessionKey, text, signal)`:
  1. `subscribe(sessionKey)` and await the subscription's `res`.
  2. Record the most-recent `seq` already seen on the subscription as the baseline. Subsequent yields filter out any event whose `seq` ≤ baseline (i.e., we ignore transcript history that arrived as part of subscribe-time backfill; the user's freshly-sent message defines the boundary).
  3. `invoke("chat.send", {sessionKey, text}, signal)`. Don't await — track its promise but yield events concurrently.
  4. For each subsequent transcript event, run it through the **adapter** (next section) and yield mapped `StreamEvent`s.
  5. Stop yielding when:
     - The `chat.send` promise resolves AND a turn-complete marker has been seen (whichever is later), OR
     - The signal aborts → call `invoke("chat.abort", {sessionKey})` and yield `{type: "error", message: "aborted"}`, OR
     - Transport reset → yield `{type: "error", message: "connection-reset"}`.
  6. Always `unsubscribe()` in `finally`.

### `lib/openclaw/adapter.ts` (new, small)

Pure functions that map openclaw transcript events → v1 `StreamEvent`. Isolated for testability.

```ts
export function adaptTranscriptEvent(ev: TranscriptEvent, prev: AdapterState): { out: StreamEvent[]; next: AdapterState };
```

`AdapterState` is small (last seen `seq`, set of in-flight tool ids, accumulated text deltas). The adapter is a pure reducer — no I/O.

This is the file we change if integration shows our event-shape assumptions are wrong. The rest of the app is shielded.

### `lib/openclaw/events.ts` (mostly unchanged)

Existing v1 `StreamEvent` union (`token | tool_call | tool_result | thinking | done | error`) is kept as the **internal** wire format between server and browser. This is the contract `useChat` consumes.

Add a parallel zod schema for `TranscriptEvent` (the openclaw-side type), used by `connection.ts` to validate incoming frames.

### `lib/openclaw/index.ts`

Stays as a singleton accessor but now also holds the `GatewayConnection`:

```ts
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

export function __resetClientForTests() { /* close connection, clear caches */ }
```

### Tests

The fake gateway gets richer. New test fixture `lib/openclaw/__tests__/fakeGateway.ts` (renamed from `fakeWsServer.ts`):

- Listens on a random port.
- Speaks the openclaw protocol: pushes `connect.challenge`, accepts `req: connect`, replies `res: hello-ok`, dispatches subsequent `req`s by method name, allows the test to inject events into a subscribed session.

Test files:

- `connection.test.ts` — handshake success, handshake failure, RPC dispatch, subscription fan-out, reconnect with re-subscribe, abort.
- `adapter.test.ts` — pure-function tests for each TranscriptEvent → StreamEvent mapping (table-driven).
- `client.test.ts` — high-level Client behavior using the fake gateway end-to-end.
- `events.test.ts` — extended for `TranscriptEvent` schema.

E2E (`e2e/chat.spec.ts`) — its fixture (`e2e/fixtures/gateway.ts`) is rewritten to speak the real protocol. The Playwright assertions stay the same (a streamed "hello world" + visible tool call).

Existing v1 unit tests for routes, hooks, and components remain unchanged — they mock at the `Client` level or at the `fetch` boundary, neither of which changes.

## Data flow: one user message (v1.1)

1. User submits → POST `/api/chat` → SSE route handler calls `client.sendMessage(sessionKey, text, signal)`.
2. `client.sendMessage` calls `connection.subscribe(sessionKey)` → `req: sessions.messages.subscribe`, awaits `res`. Subscription registered.
3. `client.sendMessage` issues `req: chat.send` with the user text.
4. Gateway pushes a stream of `event: session.message` and `event: session.tool` frames over the same WS.
5. `connection` fans these out to the subscriber's `AsyncIterable`.
6. `client.sendMessage` adapts each event via `adapter.ts` and yields one or more `StreamEvent`s to the SSE route handler.
7. SSE route handler serializes each as an SSE frame to the browser.
8. `useChat` parses, updates the message buffer, and renders incrementally.
9. On turn complete (or abort/error), `client.sendMessage`'s `finally` block runs `req: sessions.messages.unsubscribe`.

## Error handling

| Failure | Behavior |
|---|---|
| Token missing / config missing | App boots into `/setup` (unchanged from v1). |
| Gateway not running | `health()` rejects → `/api/health` returns 503 → StatusBanner shows red. Composer disabled. |
| Handshake fails | Connection is in error state; `health()` reports the reason; no chat possible. |
| Mid-stream WS drop | All in-flight invokes reject with `transport-reset`; subscriptions buffer until reconnect; on reconnect, subscriptions are re-issued. Active `sendMessage` calls receive a single `{type: "error", message: "connection-reset"}` and end. |
| `chat.send` returns `ok: false` | Adapter emits a final `{type: "error", message: <reason>}`. |
| Abort signal fires | `client.sendMessage` issues `chat.abort`, yields a final `error` event, unsubscribes. |
| Unknown event family | Logged at server, dropped — never crashes the stream. |

## Migration plan (commit shape)

The work happens on a **new branch `feat/v1.1-real-gateway`** branched from `feat/v1-chat-app` (so v1 stays inspectable). Tasks land as a TDD sequence similar to v1:

1. `lib/openclaw/connection.ts` + handshake tests.
2. RPC dispatch + tests.
3. Subscription fan-out + tests.
4. Reconnect / heartbeat + tests.
5. `lib/openclaw/adapter.ts` + table-driven mapping tests.
6. Rewrite `client.ts` against the new connection + tests.
7. Update fake gateway fixtures and the Playwright e2e test.
8. Manual validation against the real openclaw install — capture and document any unexpected event shapes; fix in `adapter.ts` only.

Routes, hooks, and components are untouched. The whole `app/` and `components/` and `hooks/` trees should remain green on existing tests throughout.

## Stack

No new dependencies. The existing `ws` package handles client-side WebSocket on the server. `zod` validates incoming frames. `vitest`, `@testing-library/react`, `playwright` continue.

## Assumptions to verify during implementation

1. **Backend handshake works on loopback with shared-secret token alone.** Spec says yes; verify against the running gateway. If `device` is required after all, fall back to a one-time pairing flow during setup.
2. **`chat.history` returns shape compatible with v1's `Message {role, text, at}`.** Most likely needs an adapter (display-normalized rows include directives/metadata). Map in `client.ts`.
3. **`session.message` events deliver token deltas, not just full messages.** Critical for the streaming UX. If they only deliver finalized rows, we lose token-by-token rendering and instead show the message as a single block per role-turn. Fall back is acceptable but should be explicit, not silent.
4. **`chat.abort` is honored mid-run.** Important for the abort-on-unmount behavior we already wired in v1.

If any of (1)–(4) doesn't hold, the design comment lives at the top of `adapter.ts` documenting the actual behavior, and the v1 frontend continues to render whatever the adapter emits.

## Out of scope follow-ups

- Configuration UI (still v2 territory).
- Showing per-message token/cost via `sessions.usage`.
- Subscription to `sessions.changed` for live sidebar updates (currently the sidebar is server-rendered once).
- Approval flows (`exec.approval.*`) — surfacing approval prompts in the UI.
- Multi-agent picker (currently one default agent).
