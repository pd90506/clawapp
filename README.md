# clawapp

A chat-first webapp for [openclaw](https://github.com/openclaw/openclaw) with rich markdown, code, math, image, and agent-trace rendering.

## Run

```bash
pnpm install
pnpm dev
```

Configuration is auto-discovered from `~/.openclaw/openclaw.json`. Override with `OPENCLAW_GATEWAY_URL` and `OPENCLAW_TOKEN` env vars (env takes precedence when both are set).

## Test

```bash
pnpm test       # vitest unit + component tests
pnpm test:e2e   # playwright smoke against a fake gateway
pnpm typecheck  # tsc --noEmit
pnpm build      # next build
```

## Design

See [docs/superpowers/specs/2026-05-08-openclaw-webapp-chat-design.md](docs/superpowers/specs/2026-05-08-openclaw-webapp-chat-design.md) for the v1 design and [docs/superpowers/plans/2026-05-08-openclaw-webapp-chat.md](docs/superpowers/plans/2026-05-08-openclaw-webapp-chat.md) for the implementation plan.

## What's in scope (v1)

- Polished chat with markdown, GFM tables, syntax-highlighted code (Shiki), KaTeX math, images.
- Streamed responses via Server-Sent Events.
- Visible agent traces: collapsible tool-call panels and thinking blocks.
- openclaw is the source of truth for sessions and history (no local DB).

## Out of scope (v1)

- Configuration UI (agents, models, plugins, MCP).
- Local persistence.
- Message edit / regenerate.
- File uploads, voice.
- Multi-user / remote deployment.
