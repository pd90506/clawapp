# clawapp v1 — chat-first webapp for openclaw

**Status:** design approved 2026-05-08
**Scope:** v1 only (chat interface). Configuration UI is a follow-up spec.

## Goal

A locally-run web app that gives openclaw a richer chat interface than its built-in `control-ui` — markdown, syntax-highlighted code, math, images, tables, streaming, and visible agent traces (tool calls, thinking). Configuration management is explicitly **out of scope** for v1.

## Non-goals (v1)

- Editing agents, models, plugins, or any openclaw configuration through the UI.
- Multi-user auth, accounts, sharing.
- Remote deployment. v1 runs on the same host as openclaw, on loopback only.
- Local persistence (sessions/messages live in openclaw).
- Message edit / regenerate / branch.
- Voice, image generation, file upload (read-only image rendering inside markdown is in scope; uploading attachments is not).

## Source-of-truth & connection model

- openclaw is the source of truth for sessions and history. We call its gateway and re-fetch on reload.
- The gateway lives at `127.0.0.1:18789` with bearer-token auth. Token + URL are read at server boot from `~/.openclaw/openclaw.json` (`gateway.port`, `gateway.auth.token`). If the file is unreadable, fall back to `OPENCLAW_GATEWAY_URL` and `OPENCLAW_TOKEN` env vars. If neither is available, the app boots into a setup-screen state.
- The bearer token never reaches the browser. All gateway traffic is proxied by Next.js server routes.

## Architecture

```
Browser (React 19, Tailwind, shadcn/ui)
   │  fetch (JSON) + EventSource (SSE)
   ▼
Next.js server routes (app/api/*)
   │  WebSocket / HTTP to openclaw gateway
   ▼
openclaw gateway @ 127.0.0.1:18789
```

- Browser → server: SSE for streamed agent output, JSON for everything else. SSE chosen over WebSocket because the stream is one-way (server → client), reconnects automatically, and is trivial to implement in Next route handlers.
- Server → openclaw: opaque to the rest of the app. The current assumption is WebSocket for streaming and HTTP for session list/history. Confirmed at integration time; if it differs, only `lib/openclaw/client.ts` changes.

## Modules

Each module has one responsibility, a typed surface, and is independently testable.

### `lib/openclaw/client.ts`
Typed wrapper around the gateway. Loads config once at boot. Public surface:

- `listSessions(): Promise<SessionSummary[]>`
- `getHistory(sessionId: string): Promise<Message[]>`
- `sendMessage(sessionId: string, text: string): AsyncIterable<StreamEvent>`
- `health(): Promise<{ ok: boolean; reason?: string }>`

`StreamEvent` is a discriminated union: `token | tool_call | tool_result | thinking | done | error`. The client maintains the upstream WS connection across idle periods (reconnect with backoff for the *control* connection), but does **not** automatically resume an interrupted in-flight message stream — if a stream drops mid-message, the caller receives a single terminal `error` event and decides whether to retry.

Depends on: `node:fs` (config load), `ws` or `undici` (upstream transport), `zod` (response validation).

### `app/api/sessions/route.ts`, `app/api/sessions/[id]/route.ts`
JSON route handlers. `GET /api/sessions` returns the session list; `GET /api/sessions/[id]` returns history for one session. Thin — delegate to `lib/openclaw/client.ts`.

### `app/api/chat/route.ts`
SSE route handler. Accepts `POST { sessionId, text }`, returns `text/event-stream`. Pipes `client.sendMessage(...)` events out as SSE frames typed by event name (`event: token`, etc.). Handles client disconnect by aborting the upstream stream.

### `app/api/health/route.ts`
JSON. Returns gateway reachability so the UI can show a connection banner.

### `hooks/useChat.ts`
Owns the chat session lifecycle on the client:

- Holds the message buffer (history + in-flight streaming message).
- Optimistically inserts the user's message on submit.
- Opens an `EventSource` to `/api/chat` per send, dispatches typed events into the buffer.
- Exposes `{ messages, status, send, error, reconnect }`.

### `components/chat/`
Stateless presentation, driven by `useChat`.

- `MessageList` — virtualized list (only if it becomes a perf issue; not v1).
- `Message` — renders one finalized message; delegates content to `components/render/Markdown`.
- `StreamingMessage` — renders the in-flight message; re-renders incrementally as tokens arrive.
- `Composer` — textarea + send button. Cmd/Ctrl-Enter submits. Disabled when gateway is down.

### `components/render/Markdown.tsx`
The markdown pipeline. Built on `react-markdown` with:

- `remark-gfm` — tables, task lists, autolinks, strikethrough.
- `remark-math` + `rehype-katex` — `$inline$` and `$$block$$` math.
- `shiki` (via a custom rehype plugin or async `<Code>` component) — syntax highlighting for fenced code blocks. Theme matches app theme.
- Custom `<a>` renderer — opens external links in new tab with `rel="noopener noreferrer"`.
- Custom `<img>` renderer — lazy-load, max-width, `referrerPolicy="no-referrer"`.
- Raw HTML in markdown is **disabled** by default (security).

Memoization: each finalized assistant message is memoized so re-renders during streaming don't re-parse old messages.

### `components/agent-trace/`
Distinct rendering for non-text stream events.

- `ToolCallPanel` — collapsible. Header shows tool name + status (pending → done/error). Body shows args (JSON, monospace) and result (markdown if string, JSON tree if object). Default collapsed once the tool returns.
- `ThinkingPanel` — collapsible. Header "Thinking…" while streaming, "Thoughts" once complete. Body is markdown. Default collapsed once done.

These panels render inline in the assistant message in the order they arrived, interleaved with text tokens.

### `components/connection/StatusBanner.tsx`
Polls `/api/health` every 10s. Shows a top banner when the gateway is unreachable; hides when healthy.

## Data flow: one user message

1. User types in `Composer`, submits.
2. `useChat.send(text)` optimistically appends a `user` message and an empty in-flight `assistant` message, then `POST /api/chat` and opens an `EventSource` on the response.
3. Server route invokes `client.sendMessage(sessionId, text)` and forwards each event as an SSE frame.
4. `useChat` dispatches each event:
   - `token` → append to current text segment of the in-flight message.
   - `tool_call` → push a new `ToolCallPanel` block.
   - `tool_result` → resolve the matching panel.
   - `thinking` → append to / open a `ThinkingPanel`.
   - `done` → finalize the message; close the `EventSource`.
   - `error` → mark the message errored; show retry.
5. Assistant message is composed of an ordered list of blocks (`{kind: "text", md: string} | {kind: "tool_call", ...} | {kind: "thinking", ...}`); the renderer walks the list.

## Error handling

| Failure | Behavior |
|---|---|
| Gateway unreachable at boot | App loads, `StatusBanner` shows "openclaw gateway unreachable", `Composer` disabled, retry button. |
| Token file missing AND env vars missing | Setup screen with instructions: where the token lives, what env vars to set. No partial functionality. |
| Mid-stream failure | Partial content preserved, message marked errored, "Retry" button re-sends. |
| `/api/chat` 5xx before stream opens | `useChat` surfaces an error toast; in-flight message rolled back. |
| Upstream WS drops mid-stream | `lib/openclaw/client.ts` emits a single `error` event; UI handles per row above. No automatic resend. |

## Testing

- **`lib/openclaw/client.ts`** — Vitest unit tests against a fake gateway (mock WS server + HTTP fixtures). Cover: config loading (file present, file missing → env, both missing), each endpoint, stream event parsing, terminal error.
- **Markdown pipeline** — snapshot tests on tricky inputs: math inside code fences (must NOT render math), nested fences, GFM tables, raw HTML (must be escaped), images.
- **`useChat`** — hook tests with a fake `EventSource`. Cover: optimistic insert, token append, tool-call interleaving, error path, abort on unmount.
- **End-to-end smoke** — one Playwright test: app boots against a mock gateway, user sends "hi", assertion that streamed tokens render and a tool-call panel appears.

CI: `pnpm test` runs Vitest + Playwright. Type-check via `tsc --noEmit`. Lint via ESLint (Next.js default config).

## Stack

- Next.js 15 (App Router) · React 19 · TypeScript 5
- Tailwind 4 · shadcn/ui (Radix primitives)
- `react-markdown` + `remark-gfm` + `remark-math` + `rehype-katex` + `shiki`
- `zod` for gateway response validation
- `ws` or `undici` for upstream transport (decided during integration)
- Vitest + `@testing-library/react` + Playwright
- pnpm (matches openclaw's tooling)

## Layout (initial sketch, refinable in implementation)

- Single full-height page. Left: collapsible sessions list (read-only for v1 — click to switch session, no rename). Main: message list scrolling area + sticky composer at the bottom. Top-right: status indicator (green/red dot + tooltip).
- Theme: dark by default, light toggle. Tailwind theme tokens, no hardcoded colors.

## Assumptions to verify during implementation

1. openclaw's gateway streams agent output over WebSocket. If it's SSE or chunked HTTP, `lib/openclaw/client.ts` adapts; the rest of the app is unaffected.
2. v1 targets the `main` agent (`~/.openclaw/agents/main`). Session selection chooses *which conversation*, not *which agent*. Agent picker is a follow-up.
3. Tool-call, tool-result, and thinking events are tagged distinctly in the gateway stream. If the runtime emits them as opaque text, we'll add a parsing layer in `lib/openclaw/client.ts`.
4. Loopback-only deployment. No CORS, CSRF, or rate-limiting work in v1 beyond Next.js defaults.

## Out-of-scope follow-ups (separate specs)

- Configuration UI (agents, models, plugins, MCP servers) — QwenPaw parity track.
- Local persistence (titles, search, tags) — additive sidecar SQLite.
- Message edit / regenerate / branch.
- File and image uploads.
- Multi-user / remote deployment / auth beyond loopback.
