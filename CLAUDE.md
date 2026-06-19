# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`clawapp` is a Next.js 16 (App Router, React 19) chat-first web frontend for [openclaw](https://github.com/openclaw/openclaw). It is a thin client over the openclaw gateway — **no local DB**, no auth beyond loopback. The gateway owns sessions and history.

## Commands

```bash
pnpm dev              # next dev on :3000
pnpm dev:preview      # NEXT_PREVIEW=1 next dev (port 3001 via separate .next-preview)
pnpm build            # next build
pnpm typecheck        # tsc --noEmit
pnpm lint             # eslint
pnpm test             # vitest run (unit + component, jsdom)
pnpm test:watch       # vitest
pnpm test -- path/to/file.test.ts          # single test file
pnpm test -- -t "pattern"                  # filter by test name
pnpm test:e2e         # playwright; spawns fake gateway (e2e/gateway-server.ts) + dev server on :3099
```

E2E uses an in-process fake gateway on port 39789 — see `playwright.config.ts`. The Next.js server is booted with `NEXT_E2E=1` and env-injected `OPENCLAW_GATEWAY_URL` / `OPENCLAW_TOKEN`. The fake gateway must come up before Next starts (Next's persistent WS connects on boot).

## Architecture

### Two halves separated by Next.js API routes

The bearer token must never reach the browser. Therefore:

- **Server side** (`lib/openclaw/`): owns one persistent WebSocket to the gateway, multiplexes all RPCs and per-session subscriptions over it, reconnects with exponential backoff. Created lazily and cached process-wide via `getClient()` in [lib/openclaw/index.ts](lib/openclaw/index.ts).
- **Browser side** (`app/`, `components/`, `hooks/`): only talks to local Next.js routes under `/api/*`. Streaming happens via SSE from `/api/chat`.

When adding a new gateway capability, add it to `lib/openclaw/client.ts` (typed wrapper) and expose it through a route in `app/api/*`. Don't shortcut by calling the gateway from a client component.

### lib/openclaw layering

- `config.ts` — resolves gateway URL+token. Env (`OPENCLAW_GATEWAY_URL`, `OPENCLAW_TOKEN`) wins; falls back to `~/.openclaw/openclaw.json`. Returns `null` if neither — pages then redirect to `/setup`.
- `protocol.ts` — frame envelopes (`req`/`res`/`event`) matching openclaw's TypeBox schemas. See [docs/openclaw-protocol-notes.md](docs/openclaw-protocol-notes.md) for the full protocol map (handshake, methods, events) we discovered by reading `dist/`.
- `connection.ts` — `GatewayConnection`: single WS, handshake (`connect.challenge` → `connect` with `client.mode: "backend"`, role `operator`), pending-request map, subscription refcounts, backoff reconnect.
- `client.ts` — typed RPC surface (`listSessions`, `createSession`, `patchSessionLabel`, `getMessages`, `sendMessage`, …).
- `events.ts` / `adapter.ts` — translate gateway event frames into the `StreamEvent` union the SSE route emits.

### Streaming path

`POST /api/chat` (`app/api/chat/route.ts`) is the hot path: it iterates `client.sendMessage()` async-generator and writes `event: <type>\ndata: <json>\n\n` SSE frames. The browser parses these in [hooks/sseParse.ts](hooks/sseParse.ts) and reduces them in [hooks/useChat.ts](hooks/useChat.ts) into a streaming-message state (text deltas, tool calls, thinking blocks, `done`/`error`). Auto-labelling of "New chat" sessions on first user turn is fire-and-forget inside this route.

### UI shell

[components/shell/AppShell.tsx](components/shell/AppShell.tsx) composes: `LeftSidebar` (sessions, pinned via localStorage in [hooks/usePinnedSessions.ts](hooks/usePinnedSessions.ts)), `TopBar`, `ChatView`, `RightDrawer`. Width state lives in [hooks/useSidebarState.ts](hooks/useSidebarState.ts) / `useLayoutWidths.ts`.

`components/render/` does markdown — `react-markdown` + `remark-gfm` + `remark-math` + `rehype-katex`, with `Shiki` highlighting in `CodeBlock.tsx`. `isomorphic-dompurify` sanitises. Agent traces (tool calls, thinking) render via `components/agent-trace/`.

### Sessions

Server is the source of truth. Sessions created by clawapp use the key prefix `web:<uuid>` and live in `~/.openclaw/agents/<agentId>/sessions/<uuid>.jsonl`. Pins are browser-local (localStorage) until the gateway exposes a server-side pin store.

## Conventions

- **Path alias**: `@/*` → repo root (see `tsconfig.json`). Use it.
- **Validation**: `zod` for all API-route inputs. See `app/api/chat/route.ts` for the pattern (parse → 400 on failure).
- **Tests live next to source** as `*.test.ts(x)`. Vitest config in `vitest.config.ts` (jsdom, setup in `vitest.setup.ts`).
- **No new client-side gateway calls** — always proxy through `app/api/*`.
- **Three Next build dirs** coexist (`.next`, `.next-e2e`, `.next-preview`) so dev/e2e/preview can run in parallel without stomping each other.
