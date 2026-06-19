# clawapp

A chat-first desktop and web client for [openclaw](https://github.com/openclaw/openclaw). It talks to your local openclaw gateway over its native WebSocket protocol and gives you a polished conversation UI — rich markdown, syntax-highlighted code, math, images, and visible agent traces (tool calls, thinking) — with the gateway as the single source of truth for sessions and history. No local database.

Runs in the browser (Next.js) or as a native desktop app (Electron).

## Features

- **Rich rendering** — GitHub-flavored markdown, Shiki syntax highlighting, KaTeX math, and images, sanitized with DOMPurify.
- **Streamed responses** — tokens stream to the browser over Server-Sent Events; text deltas, tool calls, and thinking blocks render live.
- **Agent traces** — collapsible tool-call panels and thinking blocks so you can see what the agent actually did.
- **Real new-session `/new`** — mints a genuinely new, zero-context session for the agent and stitches prior sessions above a "New session started" divider. The chain, order, and dividers are reconstructed entirely from `sessions.list` — reload-safe with no client state.
- **`/` command & skill autocomplete** — typing `/` opens a "Commands & skills" popup of the live gateway inventory (`commands.list`, scoped to the agent, with descriptions). Filters as you type, full keyboard nav (↑/↓/Enter/Tab/Esc), and a `skill` badge on skill-sourced entries.
- **Token stays server-side** — the gateway bearer token never reaches the browser; all gateway calls are proxied through Next.js API routes.
- **Gateway is the source of truth** — sessions live in `~/.openclaw/agents/<agentId>/sessions/<uuid>.jsonl`, the same place CLI and Telegram sessions live.

## Tech stack

- **[Next.js](https://nextjs.org) 16 (App Router) + [React](https://react.dev) 19** — UI and server-side API routes.
- **[Electron](https://www.electronjs.org)** — desktop packaging.
- **Markdown pipeline** — `react-markdown`, `remark-gfm`, `remark-math`, `rehype-katex`, `shiki`, `katex`, `isomorphic-dompurify`.
- **`ws`** — persistent WebSocket connection to the openclaw gateway.
- **`zod`** — validation for all API-route inputs.
- **[Vitest](https://vitest.dev)** (unit + component, jsdom) and **[Playwright](https://playwright.dev)** (e2e against an in-process fake gateway).

## Getting started

```bash
pnpm install
pnpm dev          # next dev on http://localhost:3000
```

Use `pnpm dev:preview` to run on port 3001 alongside an existing dev server.

The app auto-discovers your gateway from `~/.openclaw/openclaw.json`. Override with env vars (these take precedence):

```bash
OPENCLAW_GATEWAY_URL=http://127.0.0.1:18789
OPENCLAW_TOKEN=<your-bearer-token>
```

If neither is available, the app boots into a setup screen with instructions.

### Desktop (Electron)

```bash
pnpm electron            # run the Electron shell
pnpm build:standalone    # next build + prepare standalone bundle
pnpm dist                # build a distributable via electron-builder
```

## Scripts

```bash
pnpm dev          # next dev (:3000)
pnpm build        # next build
pnpm start        # next start
pnpm typecheck    # tsc --noEmit
pnpm lint         # eslint
pnpm test         # vitest run (unit + component)
pnpm test:e2e     # playwright smoke against an in-process fake gateway
pnpm screenshots  # playwright screenshot suite
```

## Architecture

The bearer token must never reach the browser, so clawapp is split into two halves joined by Next.js API routes:

- **Server side** (`lib/openclaw/`) owns one persistent WebSocket to the gateway, multiplexes all RPCs and per-session subscriptions over it, and reconnects with exponential backoff. It identifies as a trusted backend client over loopback (no device pairing).
- **Browser side** (`app/`, `components/`, `hooks/`) only talks to local `/api/*` routes. The hot path is `POST /api/chat`, which streams gateway events to the browser as SSE frames.

When adding a gateway capability, add it to `lib/openclaw/client.ts` and expose it through an `app/api/*` route — never call the gateway directly from a client component.

## Project structure

```
app/         Next.js App Router pages + /api routes (proxy to the gateway)
components/  UI — chat, shell, sidebar, render (markdown), agent-trace
hooks/       Client state — useChat (SSE reducer), session/layout state
lib/openclaw/ Server-side gateway client (connection, protocol, RPC, events)
electron/    Electron main process + packaging
e2e/         Playwright tests + in-process fake gateway
docs/        Protocol notes and design specs
```

See [docs/openclaw-protocol-notes.md](docs/openclaw-protocol-notes.md) for the gateway protocol map (frame envelopes, methods, events) discovered while building this, and [CLAUDE.md](CLAUDE.md) for deeper architecture and conventions.

## License

See [LICENSE](LICENSE).
