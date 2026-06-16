# openclaw gateway protocol — implementation notes

<!-- Generated from dist source reading on 2026-05-08. All line refs are to
     /opt/homebrew/lib/node_modules/openclaw/dist/ unless otherwise noted. -->

## Frame envelope

- **req**:   `{type:"req", id:string, method:string, params:object}`
- **res**:   `{type:"res", id:string, ok:boolean, payload?:any, error?:{code?,message,...}}`
- **event**: `{type:"event", event:string, payload:object, seq?:number, stateVersion?:number}`

Cross-reference: `dist/gateway/protocol/index.js` (re-exports `RequestFrameSchema`,
`ResponseFrameSchema`, `EventFrameSchema`, `GatewayFrameSchema` from
`dist/protocol-MvVoNN0Z.js`). The actual TypeBox definitions live in that bundle.

The `error` field on `res` follows `ErrorShapeSchema` (same file). `ErrorCodes` is also
exported from the same bundle (e.g. `ErrorCodes.INVALID_REQUEST`, `ErrorCodes.UNAVAILABLE`).

## Handshake (verified)

1. **Server → Client (pre-connect):** pushes `event: "connect.challenge"` with payload
   `{nonce: string, ts: number}`.

2. **Client → Server:** sends `req: "connect"` with params shape (from
   `dist/protocol-MvVoNN0Z.js:ConnectParamsSchema`):

```json
{
  "type": "req",
  "id": "...",
  "method": "connect",
  "params": {
    "minProtocol": 3,
    "maxProtocol": 4,
    "client": {
      "id": "gateway-client",
      "version": "...",
      "platform": "...",
      "mode": "backend"
    },
    "role": "operator",
    "scopes": ["operator.read", "operator.write"],
    "caps": [],
    "commands": [],
    "permissions": {},
    "auth": { "token": "<bearer>" },
    "locale": "en-US",
    "userAgent": "clawapp/1.1.0"
  }
}
```

3. **Server → Client (success):**

```json
{
  "type": "res",
  "id": "...",
  "ok": true,
  "payload": {
    "type": "hello-ok",
    "protocol": 4,
    "server": { "version": "...", "connId": "..." },
    "features": { "methods": ["..."], "events": ["..."] },
    "snapshot": {},
    "auth": {
      "role": "operator",
      "scopes": ["operator.read", "operator.write"]
    },
    "policy": {
      "maxPayload": 26214400,
      "maxBufferedBytes": 52428800,
      "tickIntervalMs": 15000
    }
  }
}
```

Cross-reference: `docs/gateway/protocol.md:27-98`. `HelloOkSchema` in
`dist/protocol-MvVoNN0Z.js`. All of `server`, `features`, `snapshot`, `auth`,
`policy` are required by the schema.

**Protocol version negotiation (verified against openclaw 2026.6.6, 2026-06-16).**
The gateway now requires protocol **4** (`PROTOCOL_VERSION = 4`,
`MIN_CLIENT_PROTOCOL_VERSION = 4` in `dist/version-51ymduTn.js`). The handshake
handler accepts a connect iff `maxProtocol >= 4 && minProtocol <= 4`
(`dist/message-handler-Cu13uhfp.js:898`); otherwise it replies
`res ok:false {code:"INVALID_REQUEST", message:"protocol mismatch",
details:{code:"PROTOCOL_MISMATCH", clientMinProtocol, clientMaxProtocol,
expectedProtocol:4, minimumProbeProtocol:4}}` and closes the socket with WS code
`1002`. Our client therefore sends `minProtocol: 3, maxProtocol: 4`
(`lib/openclaw/connection.ts:196`) — `max>=4` satisfies the requirement while
`min:3` stays backward-compatible with a hypothetical protocol-3 server. The
server then returns `protocol: 4` in `hello-ok`. (Empirically: `min=3,max=3` is
rejected with the error above; `min=3,max=4` negotiates `protocol=4`.)

**Retryable startup race:** if sidecars aren't ready, `connect` can return
`ok: false` with `error.details.reason = "startup-sidecars"` and
`retryAfterMs`. Clients should retry rather than treating it as a hard failure
(protocol.md:100-104).

## Backend identity (loopback shared-secret)

- `client.id = "gateway-client"` (from `GATEWAY_CLIENT_IDS.GATEWAY_CLIENT` in
  `dist/client-info-DQju26jn.js:6`)
- `client.mode = "backend"` (from `GATEWAY_CLIENT_MODES.BACKEND` ibid.:18)
- `auth = {token: "<bearer>"}` — shared gateway token
- `device` field: **omitted** — explicitly permitted on direct loopback connects
  with shared gateway token. (protocol.md:125-128; `dist/gateway-BLR6Zsy8.js:108-111`
  shows the internal callGateway path using `GATEWAY_CLIENT` id + `BACKEND` mode
  with no device field.)
- This path bypasses stale CLI/device pairing baseline checks.

## Methods we use — verified shape from dist source

### `health`

- **params:** `{}` or omitted (schema: `Type.Object({})` with `additionalProperties: false`,
  but actual handler accepts any `params` — it only reads `params?.probe === true`).
- **payload:** a health snapshot object. Fields include `channels`, `ts`, `ok` and
  potentially `eventLoop`. Sensitive fields (`includeSensitive`) included only if
  `operator.admin` scope is present.
- **scope:** `operator.read` (read scope also satisfied by `operator.write`)
  — `dist/method-scopes-CXVBHLXE.js:51`
- **source:** `dist/server-methods-DStUV8Sh.js:4772-4801`

Note: `health` does NOT require an explicit scope object in the params. Handler
reads `client.connect.scopes` to decide whether to include sensitive data.

### `sessions.list`

- **params schema:** `SessionsListParamsSchema` at `dist/protocol-MvVoNN0Z.js:1959-1982`.
  All fields optional: `limit?`, `activeMinutes?`, `includeGlobal?`, `includeUnknown?`,
  `includeDerivedTitles?`, `includeLastMessage?`, `label?`, `spawnedBy?`, `agentId?`,
  `search?`.
- **payload:**
  ```ts
  {
    ts: number,
    path: string,
    count: number,
    totalCount: number,
    limitApplied: boolean,
    hasMore: boolean,
    defaults: {...},
    sessions: SessionRow[]
  }
  ```
- **Session row key field:** `key` — this is the session identifier to use in all other calls.
  There is NO top-level `id` field on session rows. `sessionId` (internal UUID) is separate.
  (`dist/session-utils-Cl-I1HfR.js:909-974` — `buildGatewaySessionRow` returns `{key, ...}`)
- **Title/name field:** Session rows have `displayName` (optional), `derivedTitle` (optional,
  only populated if `includeDerivedTitles: true` was passed), and `label` (optional).
  There is NO `title` field or `name` field on the session row itself.
  To get a human-readable label, use `displayName ?? derivedTitle ?? label ?? key`.
- **`hasActiveRun` field:** injected by `sessions.list` handler — `session.hasActiveRun:
  boolean` (`dist/server-methods-DStUV8Sh.js:7934-7938`).
- **scope:** `operator.read` — `dist/method-scopes-CXVBHLXE.js:77`
- **source:** `dist/server-methods-DStUV8Sh.js:7919-7939`

### `chat.history`

- **params schema:** `ChatHistoryParamsSchema` at `dist/protocol-MvVoNN0Z.js:1615-1625`.
  ```ts
  { sessionKey: string, limit?: number (1-1000), maxChars?: number (1-500000) }
  ```
- **payload:**
  ```ts
  {
    sessionKey: string,
    sessionId: string | undefined,
    messages: Message[],
    thinkingLevel: string | undefined,
    fastMode: boolean | undefined,
    verboseLevel: string | undefined
  }
  ```
- **Message field names:** messages from the transcript are deserialized as-is from JSONL.
  - Text field: messages can have either `content: string | ContentBlock[]` OR `text: string`
    depending on the role/source. The display projection (stripping directives) operates on
    both `entry.content` and `entry.text` (`dist/chat-display-projection-S_bLdIwq.js:191-228`).
    **Do not assume a single field name** — check both.
  - Role values seen in projection code: `"assistant"`, `"user"`, `"tool"` / `"toolresult"` /
    `"tool_result"` / `"function"`, `"system"` (compaction entries).
    (`dist/chat-display-projection-S_bLdIwq.js:162-163`)
  - Timestamp field: `timestamp` (number — milliseconds epoch) injected by
    `attachOpenClawTranscriptMeta` (`dist/session-utils.fs-KrU2mfs9.js:761-775`).
    It is NOT `at` or `createdAt`. NOTE: `timestamp` is set for compaction entries; for regular
    messages it comes from the transcript file's own field (whatever the agent wrote — usually
    `timestamp` as well, but this is not schema-enforced in the dist layer we can read).
  - Each message also has `__openclaw: {seq: number, id?: string}` metadata injected by
    `attachOpenClawTranscriptMeta` (`dist/session-utils.fs-KrU2mfs9.js:515-526`).
- **Display normalization applied:** inline directive tags stripped, tool XML blocks stripped,
  `NO_REPLY` assistant rows omitted, oversized rows may be replaced with placeholders.
  (protocol.md:413-414)
- **scope:** `operator.read` — `dist/method-scopes-CXVBHLXE.js:100`
- **source:** `dist/chat-3xUbD00m.js:1428-1496`

### `sessions.messages.subscribe`

- **params schema:** `SessionsMessagesSubscribeParamsSchema` at
  `dist/protocol-MvVoNN0Z.js:2027`:
  ```ts
  { key: string }  // session key (NOT sessionId)
  ```
- **payload on success:**
  ```ts
  { subscribed: true, key: string }   // key = canonicalKey after store lookup
  // or if connId missing:
  { subscribed: false, key: string }
  ```
- **scope:** `operator.read` — `dist/method-scopes-CXVBHLXE.js:86`
- **source:** `dist/server-methods-DStUV8Sh.js:7980-7997`

### `sessions.messages.unsubscribe`

- **params schema:** `SessionsMessagesUnsubscribeParamsSchema` at
  `dist/protocol-MvVoNN0Z.js:2028`:
  ```ts
  { key: string }
  ```
- **payload on success:** `{ subscribed: false, key: string }`
- **scope:** `operator.read` — `dist/method-scopes-CXVBHLXE.js:87`
- **source:** `dist/server-methods-DStUV8Sh.js:7999-8009`

### `chat.send`

- **params schema:** `ChatSendParamsSchema` at `dist/protocol-MvVoNN0Z.js:1626-1641`:
  ```ts
  {
    sessionKey: string,       // required, 1-512 chars
    sessionId?: string,
    message: string,          // required (key name is "message", NOT "text")
    thinking?: string,
    deliver?: boolean,
    originatingChannel?: string,
    originatingTo?: string,
    originatingAccountId?: string,
    originatingThreadId?: string,
    attachments?: unknown[],
    timeoutMs?: number,
    systemInputProvenance?: InputProvenance,
    systemProvenanceReceipt?: string,
    idempotencyKey: string    // required
  }
  ```
- **payload on success:**
  ```ts
  { runId: string, status: "started" }
  // or if already in flight (idempotency hit):
  { runId: string, status: "in_flight" }
  ```
  **`chat.send` DOES NOT WAIT for the agent turn to finish.** It responds with
  `{runId, status: "started"}` as soon as the run is registered and dispatched — BEFORE
  any agent tokens are emitted. (`dist/chat-3xUbD00m.js:1770-1773` — `respond(true, ...)` 
  is called immediately before the `dispatchInboundMessage` pipeline runs.)
  Token stream arrives via `session.message` / `session.tool` events on the subscription.
- **Abort override:** `sessions.send` (not `chat.send`) handler has an `interruptIfActive`
  path that calls `chat.abort` before the send; raw `chat.send` does not.
- **Requiring `idempotencyKey`:** the schema marks it required. Pass a UUID.
- **scope:** `operator.write` — `dist/method-scopes-CXVBHLXE.js:133`
- **source:** `dist/chat-3xUbD00m.js:1565-1773`

### `chat.abort`

- **params schema:** `ChatAbortParamsSchema` at `dist/protocol-MvVoNN0Z.js:1642-1645`:
  ```ts
  { sessionKey: string, runId?: string }
  ```
- **payload on success:**
  ```ts
  { ok: true, aborted: boolean, runIds: string[] }
  ```
- **scope:** `operator.write` — `dist/method-scopes-CXVBHLXE.js:134`
- **source:** `dist/chat-3xUbD00m.js:1498-1563`

## Events emitted post-subscribe — verified shape

### `session.message`

Broadcast when a new or updated transcript message arrives for a subscribed session.

- **Event name:** `"session.message"`
- **Payload structure** (from `dist/server-session-events-JWeweAja.js:170-176`):
  ```ts
  {
    sessionKey: string,
    message: Message,            // display-projected message from transcript
    messageId?: string,          // present if transcript entry has an id
    messageSeq?: number,         // total message count at this point
    // + all fields from buildGatewaySessionSnapshot() = session row snapshot:
    session?: SessionRow,
    updatedAt?: number,
    sessionId?: string,
    kind?: string,
    channel?: string,
    subject?: string,
    // ... (full session state snapshot fields)
  }
  ```
- **`message` object:** is a display-projected transcript entry. Same shape as entries
  in `chat.history`. Fields include `role` and `content | text`. Can have `__openclaw` meta.
- **Role values on `session.message`:** this event carries full transcript rows (user,
  assistant, tool results, system/compaction). Role values: `"user"`, `"assistant"`,
  `"toolresult"` / `"tool_result"` / `"tool"` / `"function"`, `"system"`.
- **Delta streaming:** `session.message` carries full message rows from the transcript
  file watcher. It does NOT deliver token-by-token deltas for the assistant turn.
  The delta/streaming events for assistant typing come from the **`chat` event family**
  (event name `"chat"`), NOT from `session.message`.
  (`dist/server-chat--Kkx0ZcY.js` — `broadcast("chat", payload)` for deltas/finals;
  `broadcastToConnIds("session.message", ...)` for transcript-file updates.)
- **`chat` event payload** (for streaming tokens, from `dist/server-chat--Kkx0ZcY.js:340-350`
  and `377-387`):
  ```ts
  {
    runId: string,
    sessionKey: string,
    spawnedBy?: string,
    seq: number,
    state: "delta" | "final" | "aborted" | "error",
    message?: {
      role: "assistant",
      content: [{type: "text", text: string}],
      timestamp: number
    },
    stopReason?: string,
    errorMessage?: string,
    errorKind?: "refusal"|"timeout"|"rate_limit"|"context_length"|"unknown"
  }
  ```
  The `message.content[0].text` in a `delta` event is the **accumulated text so far**,
  not just the new delta chunk. (`dist/server-chat--Kkx0ZcY.js` — `mergedText` is the
  full buffer, not a delta slice.)
- **Turn finalization signal:** the `chat` event with `state: "final"` (or `"error"` /
  `"aborted"`) marks the end of an assistant turn. `session.message` events continue after
  this if the transcript file is still being updated (tool results, etc.) but the chat
  run itself is done.
- **`seq` field:** present on `chat` events — per-run sequence number (monotonic within
  a run). Also present as `messageSeq` on `session.message` payload (total transcript
  message count). These are different counters.
- **Requires subscription:** `session.message` is only broadcast to connections that
  subscribed via `sessions.messages.subscribe` OR `sessions.subscribe`. The `chat` event
  is broadcast to all authenticated operator connections (no per-session subscription
  needed), but is scope-gated to `operator.read`.
  (`dist/server-session-events-JWeweAja.js:157-158`,
  `dist/server-chat--Kkx0ZcY.js` — `broadcast("chat", ...)` vs
  `broadcastToConnIds("session.message", ..., connIds)`)
- **source:** `dist/server-session-events-JWeweAja.js:153-186`

### `session.tool`

Broadcast when a tool event fires on a session that has session-event subscribers
(via `sessions.subscribe`, not `sessions.messages.subscribe`).

**Important:** `session.tool` goes to `sessionEventSubscribers` (connections that called
`sessions.subscribe`), NOT to `sessionMessageSubscribers` (connections that called
`sessions.messages.subscribe`).
(`dist/server-chat--Kkx0ZcY.js:506-511` — `broadcastToConnIds("session.tool", ...,
sessionSubscribers)` where `sessionSubscribers = sessionEventSubscribers.getAll()`)

- **Event name:** `"session.tool"`
- **Payload structure** (from `dist/server-chat--Kkx0ZcY.js:508-511`):
  The payload is `{...agentPayload, ...buildSessionEventSnapshot(sessionKey)}` where
  `agentPayload` is the raw `AgentEvent`:
  ```ts
  {
    // From AgentEventSchema (dist/protocol-MvVoNN0Z.js:108-115):
    runId: string,
    seq: number,        // integer >= 0
    stream: "tool",     // the stream discriminant
    ts: number,         // integer >= 0 (milliseconds epoch)
    spawnedBy?: string,
    data: {
      phase: "start" | "result",    // these are the two emitted phases
      name: string,                 // tool name
      toolCallId: string,
      // on phase:"start":
      args?: object,               // sanitized args (may be undefined if none)
      // on phase:"result":
      meta?: string,               // human-readable tool meta/summary
      isError: boolean,
      result?: unknown             // sanitized tool result (may be omitted)
    },
    // + sessionKey and spawnedBy from agentPayload spreading
    sessionKey: string,
    spawnedBy?: string,
    // + full session snapshot fields from buildSessionEventSnapshot()
    session?: SessionRow,
    ...
  }
  ```
- **Phase values confirmed:** `"start"` and `"result"` only.
  (`dist/selection-BeP8qtCb.js:978-987` for start,
  `dist/selection-BeP8qtCb.js:1204-1215` for result).
  There is NO separate `"end"` phase on the tool stream that reaches the gateway
  broadcast — "end" is used on `item` stream events, not `tool` stream.
- **`phase: "result"` carries `isError: boolean`** — use this to distinguish tool
  success from tool failure, not a separate `"error"` phase.
- **`result` field:** present in the `emitAgentEvent` call for `phase: "result"`, but
  the `onAgentEvent` copy (forwarded to subscribers) does NOT include `result` —
  only `{phase, name, toolCallId, meta, isError}` (no result). The full result is
  in the internal `emitAgentEvent` path. At the gateway broadcast level, whether
  `result` survives depends on `toolVerbose` level: if `toolVerbose !== "full"`,
  `data.result` and `data.partialResult` are deleted before broadcast.
  (`dist/server-chat--Kkx0ZcY.js:473-485`)
- **source:** `dist/server-chat--Kkx0ZcY.js:506-511`,
  `dist/selection-BeP8qtCb.js:978-987 and 1204-1215`

### Other transcript events we should know about

- **`chat` event** (event name `"chat"`): the primary streaming event for assistant token
  deltas and turn finalization. Broadcasts to all operator connections with `operator.read`.
  Contains `{runId, sessionKey, seq, state, message?, stopReason?, errorMessage?,
  errorKind?}`. See full shape in `session.message` section above.
  `state` values: `"delta"` | `"final"` | `"aborted"` | `"error"`.
  Schema: `ChatEventSchema` at `dist/protocol-MvVoNN0Z.js:1651-1673`.

- **`sessions.changed`** (event name `"sessions.changed"`): broadcast to session-event
  subscribers when a session's metadata or lifecycle changes. Contains `sessionKey`,
  `phase` (e.g. `"message"`, `"start"`, `"end"`, `"error"`, `"send"`, `"steer"`),
  `ts`, and a full session snapshot. Emitted by both the lifecycle handler and the
  transcript update handler. (`dist/server-session-events-JWeweAja.js:177-186`,
  `dist/server-chat--Kkx0ZcY.js:287-298 and 530-546`)

- **`agent` event** (event name `"agent"`): low-level agent run events (all streams:
  `lifecycle`, `assistant`, `tool`, `item`, `plan`, `compaction`, etc.). Goes to
  `toolEventRecipients` (connections that called something to register as a tool
  event recipient) and to all connections via `broadcast("agent", ...)` for non-tool
  streams. Less relevant for our UI use case.

- **`tick`** / **`heartbeat`**: periodic keepalive events, always broadcast regardless
  of scope.

## Surprises / contradictions with the spec assumptions

1. **`session.message` does NOT carry streaming token deltas.** The spec (design doc
   assumption 3) asks "do `session.message` events deliver token deltas?" — they DO NOT.
   `session.message` events fire from the transcript file watcher when a message row
   is written to disk (which happens at the end of a turn, not incrementally). Streaming
   tokens come from the `chat` event family (`event: "chat"`), which is broadcast to all
   operator connections without a per-session subscription.
   **Impact:** `sendMessage` should listen for `chat` events (not just `session.message`)
   to render token-by-token deltas. Both subscriptions are needed: `sessions.messages.subscribe`
   to ensure the session is active, and listening to the unsolicited `chat` broadcasts
   for streaming.

2. **`session.tool` requires `sessions.subscribe`, NOT `sessions.messages.subscribe`.**
   The spec's connection design has the client call `sessions.messages.subscribe` for
   streaming. That subscription will NOT deliver `session.tool` events — those go to
   `sessionEventSubscribers` (registered via `sessions.subscribe`). Tool panel rendering
   requires calling `sessions.subscribe` as well. (`dist/server-chat--Kkx0ZcY.js:507-511`)

3. **Session identifier for all calls is `key`, not `id`.** The spec says
   `listSessions()` maps "gateway rows to `SessionSummary {id, title}`" but session rows
   have no `id` field — the identifier is `key` (a string like `"main"` or
   `"agent-name/session-name"`). `sessionId` is an internal UUID, NOT the same as
   the routing key. Using `sessionId` in `chat.send` or `chat.history` params will fail —
   those params expect `sessionKey`.

4. **Session rows have no `title` or `name` field.** The spec's `SessionSummary {id, title}`
   assumes a `title` field. Real rows have `displayName`, `derivedTitle` (only if
   `includeDerivedTitles: true` was passed), and `label`. The adapter must synthesize
   a title: `displayName ?? derivedTitle ?? label ?? key`.

5. **`chat.send` message param is `message`, not `text`.** `ChatSendParamsSchema`
   uses `message: string`. The spec wording says "`{sessionKey, text, ...?}`" — this
   is wrong. The field is `message`.

6. **`chat.history` messages may have `content` or `text` (not a guaranteed single field).**
   Display-normalized rows go through the TypeBox / pi-coding-agent pipeline which
   can produce either shape. Assumption 2 in the spec ("compatible with `Message {role,
   text, at}`") is partially wrong: the timestamp field is `timestamp` (not `at`), and
   the text may be in `content` (string or array of content blocks) not `text`. The
   adapter must handle both.

7. **`chat` delta events carry accumulated text, not incremental chunks.** The `text`
   in a `state:"delta"` `chat` event is the full assistant reply so far (merged buffer),
   not just the new tokens added since the last delta. The adapter should replace the
   previous text with the new value, not append.

8. **`sessions.messages.subscribe` / `unsubscribe` use `key` not `sessionKey`.** The
   schema field is `key` (not `sessionKey` as used in `chat.send` and `chat.history`).
   (`dist/protocol-MvVoNN0Z.js:2027-2028`)

## Open questions

1. **Does the `chat` event require `operator.read` scope or just authentication?** The
   broadcast scope gating in `protocol.md:304-309` says chat/agent frames require
   `operator.read`. Our backend connect uses `scopes: ["operator.read", "operator.write"]`
   so this should be satisfied, but worth confirming on a live connection.

2. **Exact shape of messages with `role: "user"` in `chat.history`.** We see the
   projection code strips a "user envelope" for `role: "user"` entries
   (`dist/session-utils.fs-KrU2mfs9.js:1220`). We don't know if user messages use
   `content: string` or `content: ContentBlock[]` after projection. Low risk — just
   handle both in the adapter.

3. **Does `sessions.messages.subscribe` also deliver `chat` events, or only
   `session.message`?** Based on the broadcast code, `chat` events go to ALL operator
   connections (not per-session-subscription filtered). So the client will see ALL
   sessions' `chat` events — the adapter needs to filter by `sessionKey`.

4. **`sessions.subscribe` scope vs `sessions.messages.subscribe` scope.** Both are
   `operator.read`. Our backend identity gets full operator scopes from shared-secret
   auth, so both calls should succeed.

5. **Is `sessions.subscribe` needed in addition to `sessions.messages.subscribe` to
   receive `session.tool` events?** Yes (confirmed from source). The design doc doesn't
   mention this distinction. The implementation should call both, or focus only on the
   `chat` + `agent` broadcast events for real-time streaming (which require no
   per-session subscription).

Files searched for evidence:
- `/opt/homebrew/lib/node_modules/openclaw/dist/protocol-MvVoNN0Z.js`
- `/opt/homebrew/lib/node_modules/openclaw/dist/server-methods-DStUV8Sh.js`
- `/opt/homebrew/lib/node_modules/openclaw/dist/server-chat--Kkx0ZcY.js`
- `/opt/homebrew/lib/node_modules/openclaw/dist/server-session-events-JWeweAja.js`
- `/opt/homebrew/lib/node_modules/openclaw/dist/method-scopes-CXVBHLXE.js`
- `/opt/homebrew/lib/node_modules/openclaw/dist/chat-3xUbD00m.js`
- `/opt/homebrew/lib/node_modules/openclaw/dist/session-utils-Cl-I1HfR.js`
- `/opt/homebrew/lib/node_modules/openclaw/dist/session-utils.fs-KrU2mfs9.js`
- `/opt/homebrew/lib/node_modules/openclaw/dist/chat-display-projection-S_bLdIwq.js`
- `/opt/homebrew/lib/node_modules/openclaw/dist/client-info-DQju26jn.js`
- `/opt/homebrew/lib/node_modules/openclaw/dist/gateway-BLR6Zsy8.js`
- `/opt/homebrew/lib/node_modules/openclaw/dist/selection-BeP8qtCb.js`
- `/opt/homebrew/lib/node_modules/openclaw/dist/agent-runner.runtime-DQsCsHUA.js`
- `/opt/homebrew/lib/node_modules/openclaw/docs/gateway/protocol.md`
