# clawapp

A chat-first webapp for [openclaw](https://github.com/openclaw/openclaw) — rich markdown rendering, syntax-highlighted code, math, images, agent traces (tool calls, thinking) — that talks to your local openclaw gateway over its native WebSocket protocol.

## Run

```bash
pnpm install
pnpm dev
```

Then open http://localhost:3000 (or use `pnpm dev:preview` to run on port 3001 alongside an existing dev server).

## Configuration

Auto-discovers your openclaw gateway from `~/.openclaw/openclaw.json`. Override with env vars (env takes precedence):

```bash
OPENCLAW_GATEWAY_URL=http://127.0.0.1:18789
OPENCLAW_TOKEN=<your-bearer-token>
```

If neither is available, the app boots into a setup screen with instructions.

## How it talks to openclaw

clawapp opens a single persistent WebSocket to `ws://127.0.0.1:18789/` from its server process and identifies as a trusted backend client (`client.id: "gateway-client"`, `client.mode: "backend"`) using your bearer token. No device pairing is required on loopback. The connection multiplexes all RPCs and per-session subscriptions over the same socket and reconnects with exponential backoff on drops.

The bearer token never reaches the browser. All gateway calls are server-side; the browser hits Next.js routes (`/api/health`, `/api/sessions`, `/api/sessions/[id]`, `/api/chat` for streaming) which proxy to the gateway.

See [docs/openclaw-protocol-notes.md](docs/openclaw-protocol-notes.md) for the protocol map (frame envelopes, methods, events) we discovered while building this.

## Sessions

clawapp creates new sessions via openclaw's `sessions.create` and stores them in `~/.openclaw/agents/<agentId>/sessions/<uuid>.jsonl` — the same place CLI and Telegram sessions live. clawapp-created sessions use the key prefix `web:<uuid>` to distinguish them. The session label auto-updates from the first message you send (max 40 chars). Sessions you pin from the sidebar are kept in browser localStorage (per-device) until v1.3 surfaces a server-side pin store.

## Test

```bash
pnpm test       # vitest unit + component tests
pnpm test:e2e   # playwright smoke against an in-process fake gateway
pnpm typecheck  # tsc --noEmit
pnpm build      # next build
```

## Design

- v1 (chat-first frontend): [docs/superpowers/specs/2026-05-08-openclaw-webapp-chat-design.md](docs/superpowers/specs/2026-05-08-openclaw-webapp-chat-design.md)
- v1.1 (real gateway integration): [docs/superpowers/specs/2026-05-08-openclaw-gateway-ws-v1.1-design.md](docs/superpowers/specs/2026-05-08-openclaw-gateway-ws-v1.1-design.md)

## What's in scope

- Polished chat UI with GFM markdown, syntax-highlighted code (Shiki), KaTeX math, images.
- Streamed responses via Server-Sent Events to the browser.
- Visible agent traces: collapsible tool-call panels and thinking blocks.
- openclaw is the source of truth for sessions and history (no local DB).

## Out of scope (future work)

- Configuration UI (agents, models, plugins, MCP).
- Local persistence for search/tags/exports.
- Message edit / regenerate / branch.
- File and image uploads.
- Multi-user / remote deployment / auth beyond loopback.
