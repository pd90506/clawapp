# clawapp v1 (chat-first webapp) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Next.js chat-first webapp that proxies the local openclaw gateway, rendering rich markdown (code, math, images, tables), streaming responses, and visible agent traces (tool calls, thinking).

**Architecture:** Next.js 15 App Router app. Server route handlers hold the bearer token and talk to openclaw at `127.0.0.1:18789` (HTTP for sessions, WebSocket for streaming). Browser ↔ server uses JSON for read endpoints and Server-Sent Events for chat streams. Source of truth for sessions/history is openclaw; the webapp keeps no DB.

**Tech Stack:** Next.js 15 · React 19 · TypeScript 5 · Tailwind 4 · shadcn/ui · `react-markdown` + `remark-gfm` + `remark-math` + `rehype-katex` + `shiki` · `zod` · `ws` · Vitest + Testing Library + Playwright · pnpm.

**Spec:** [docs/superpowers/specs/2026-05-08-openclaw-webapp-chat-design.md](../specs/2026-05-08-openclaw-webapp-chat-design.md)

---

## File map (locked at plan time)

```
clawapp/
├── package.json
├── tsconfig.json
├── next.config.ts
├── postcss.config.mjs
├── tailwind.config.ts
├── vitest.config.ts
├── playwright.config.ts
├── app/
│   ├── layout.tsx
│   ├── globals.css
│   ├── page.tsx                     # main chat page
│   ├── setup/page.tsx               # shown when config unavailable
│   └── api/
│       ├── health/route.ts
│       ├── sessions/route.ts
│       ├── sessions/[id]/route.ts
│       └── chat/route.ts            # SSE
├── lib/
│   └── openclaw/
│       ├── config.ts                # load ~/.openclaw/openclaw.json or env
│       ├── client.ts                # gateway wrapper (HTTP + WS)
│       ├── events.ts                # StreamEvent discriminated union + zod
│       └── __tests__/               # vitest unit tests + fake gateway
├── hooks/
│   └── useChat.ts
├── components/
│   ├── chat/
│   │   ├── MessageList.tsx
│   │   ├── Message.tsx
│   │   ├── StreamingMessage.tsx
│   │   └── Composer.tsx
│   ├── render/
│   │   └── Markdown.tsx
│   ├── agent-trace/
│   │   ├── ToolCallPanel.tsx
│   │   └── ThinkingPanel.tsx
│   └── connection/
│       └── StatusBanner.tsx
└── e2e/
    └── chat.spec.ts                 # playwright smoke
```

Each file has ONE responsibility. Tests live next to the code under `__tests__/` for `lib/`, and `*.test.tsx` co-located for components/hooks.

---

## Task 1: Scaffold Next.js + TS + Tailwind

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `tailwind.config.ts`, `app/layout.tsx`, `app/page.tsx`, `app/globals.css`, `.gitignore` (extend existing), `.eslintrc.json`

- [ ] **Step 1: Initialize Next.js with pnpm**

```bash
cd /Users/panda/repo/clawapp
pnpm dlx create-next-app@latest . --ts --tailwind --eslint --app --no-src-dir --turbopack --import-alias "@/*" --use-pnpm --yes
```

Expected: scaffolds files; preserves existing `.git`, `LICENSE`, `README.md`. If it complains about non-empty dir, allow overwrite of generated files only — do **not** lose `LICENSE` or `docs/`.

- [ ] **Step 2: Verify build runs**

```bash
pnpm build
```

Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js 15 + TS + Tailwind"
```

---

## Task 2: Add test tooling (Vitest + Testing Library + Playwright)

**Files:**
- Create: `vitest.config.ts`, `vitest.setup.ts`, `playwright.config.ts`
- Modify: `package.json` (scripts + devDeps)

- [ ] **Step 1: Install deps**

```bash
pnpm add -D vitest @vitest/ui @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom @types/node @playwright/test happy-dom
pnpm exec playwright install chromium
```

- [ ] **Step 2: Write `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    globals: true,
    include: ["**/*.test.{ts,tsx}", "**/__tests__/**/*.{ts,tsx}"],
    exclude: ["e2e/**", "node_modules/**", ".next/**"],
  },
  resolve: { alias: { "@": path.resolve(__dirname, ".") } },
});
```

Then `pnpm add -D @vitejs/plugin-react`.

- [ ] **Step 3: Write `vitest.setup.ts`**

```ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 4: Write `playwright.config.ts`**

```ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  use: { baseURL: "http://localhost:3000" },
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
```

- [ ] **Step 5: Add scripts to `package.json`**

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test"
  }
}
```

- [ ] **Step 6: Smoke-test the runner**

Create `app/page.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
describe("smoke", () => {
  it("works", () => { expect(1 + 1).toBe(2); });
});
```

Run: `pnpm test`. Expected: 1 passing. Then delete the file.

- [ ] **Step 7: Commit**

```bash
rm app/page.test.tsx
git add -A
git commit -m "chore: add vitest + playwright tooling"
```

---

## Task 3: `lib/openclaw/config.ts` — load gateway URL & token

**Files:**
- Create: `lib/openclaw/config.ts`, `lib/openclaw/__tests__/config.test.ts`

- [ ] **Step 1: Write the failing test**

`lib/openclaw/__tests__/config.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fs from "node:fs";

vi.mock("node:fs");
const mockedFs = vi.mocked(fs);

beforeEach(() => {
  vi.resetModules();
  vi.unstubAllEnvs();
  mockedFs.readFileSync.mockReset();
});

describe("loadConfig", () => {
  it("reads gateway url and token from openclaw.json", async () => {
    mockedFs.readFileSync.mockReturnValue(
      JSON.stringify({ gateway: { port: 18789, auth: { token: "tok-abc" } } })
    );
    const { loadConfig } = await import("../config");
    expect(loadConfig()).toEqual({
      url: "http://127.0.0.1:18789",
      token: "tok-abc",
      source: "file",
    });
  });

  it("falls back to env vars when file is unreadable", async () => {
    mockedFs.readFileSync.mockImplementation(() => { throw new Error("ENOENT"); });
    vi.stubEnv("OPENCLAW_GATEWAY_URL", "http://127.0.0.1:9999");
    vi.stubEnv("OPENCLAW_TOKEN", "env-tok");
    const { loadConfig } = await import("../config");
    expect(loadConfig()).toEqual({
      url: "http://127.0.0.1:9999",
      token: "env-tok",
      source: "env",
    });
  });

  it("returns null when neither file nor env are usable", async () => {
    mockedFs.readFileSync.mockImplementation(() => { throw new Error("ENOENT"); });
    const { loadConfig } = await import("../config");
    expect(loadConfig()).toBeNull();
  });
});
```

- [ ] **Step 2: Run, expect FAIL**

```bash
pnpm test lib/openclaw/__tests__/config.test.ts
```

Expected: failures — module doesn't exist.

- [ ] **Step 3: Implement `lib/openclaw/config.ts`**

```ts
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export type GatewayConfig = {
  url: string;
  token: string;
  source: "file" | "env";
};

export function loadConfig(): GatewayConfig | null {
  try {
    const raw = readFileSync(join(homedir(), ".openclaw", "openclaw.json"), "utf8");
    const parsed = JSON.parse(raw);
    const port = parsed?.gateway?.port;
    const token = parsed?.gateway?.auth?.token;
    if (typeof port === "number" && typeof token === "string" && token.length > 0) {
      return { url: `http://127.0.0.1:${port}`, token, source: "file" };
    }
  } catch {
    // fall through to env
  }
  const url = process.env.OPENCLAW_GATEWAY_URL;
  const token = process.env.OPENCLAW_TOKEN;
  if (url && token) return { url, token, source: "env" };
  return null;
}
```

- [ ] **Step 4: Run, expect PASS**

```bash
pnpm test lib/openclaw/__tests__/config.test.ts
```

Expected: 3 passing.

- [ ] **Step 5: Commit**

```bash
git add lib/openclaw/config.ts lib/openclaw/__tests__/config.test.ts
git commit -m "feat(openclaw): config loader with file + env fallback"
```

---

## Task 4: `lib/openclaw/events.ts` — typed StreamEvent + zod parsers

**Files:**
- Create: `lib/openclaw/events.ts`, `lib/openclaw/__tests__/events.test.ts`

- [ ] **Step 1: Install zod**

```bash
pnpm add zod
```

- [ ] **Step 2: Write the failing test**

`lib/openclaw/__tests__/events.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { parseStreamEvent } from "../events";

describe("parseStreamEvent", () => {
  it("parses token event", () => {
    const e = parseStreamEvent({ type: "token", text: "hi" });
    expect(e).toEqual({ type: "token", text: "hi" });
  });
  it("parses tool_call event", () => {
    const e = parseStreamEvent({ type: "tool_call", id: "t1", name: "search", args: { q: "x" } });
    expect(e?.type).toBe("tool_call");
  });
  it("parses tool_result event", () => {
    const e = parseStreamEvent({ type: "tool_result", id: "t1", result: "ok" });
    expect(e?.type).toBe("tool_result");
  });
  it("parses thinking event", () => {
    const e = parseStreamEvent({ type: "thinking", text: "hmm" });
    expect(e?.type).toBe("thinking");
  });
  it("parses done event", () => {
    expect(parseStreamEvent({ type: "done" })).toEqual({ type: "done" });
  });
  it("parses error event", () => {
    expect(parseStreamEvent({ type: "error", message: "boom" })).toEqual({ type: "error", message: "boom" });
  });
  it("returns null on unknown shape", () => {
    expect(parseStreamEvent({ type: "wat" })).toBeNull();
    expect(parseStreamEvent("not an object")).toBeNull();
  });
});
```

- [ ] **Step 3: Run, expect FAIL**

```bash
pnpm test lib/openclaw/__tests__/events.test.ts
```

- [ ] **Step 4: Implement `lib/openclaw/events.ts`**

```ts
import { z } from "zod";

export const StreamEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("token"), text: z.string() }),
  z.object({ type: z.literal("tool_call"), id: z.string(), name: z.string(), args: z.unknown() }),
  z.object({ type: z.literal("tool_result"), id: z.string(), result: z.unknown(), error: z.string().optional() }),
  z.object({ type: z.literal("thinking"), text: z.string() }),
  z.object({ type: z.literal("done") }),
  z.object({ type: z.literal("error"), message: z.string() }),
]);

export type StreamEvent = z.infer<typeof StreamEventSchema>;

export function parseStreamEvent(input: unknown): StreamEvent | null {
  const r = StreamEventSchema.safeParse(input);
  return r.success ? r.data : null;
}
```

- [ ] **Step 5: Run, expect PASS**

```bash
pnpm test lib/openclaw/__tests__/events.test.ts
```

Expected: 7 passing.

- [ ] **Step 6: Commit**

```bash
git add lib/openclaw/events.ts lib/openclaw/__tests__/events.test.ts
git commit -m "feat(openclaw): StreamEvent zod schema + parser"
```

---

## Task 5: `lib/openclaw/client.ts` — HTTP endpoints (sessions, history, health)

**Files:**
- Create: `lib/openclaw/client.ts`, `lib/openclaw/__tests__/client.http.test.ts`

- [ ] **Step 1: Write the failing test**

`lib/openclaw/__tests__/client.http.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createClient } from "../client";

const cfg = { url: "http://127.0.0.1:18789", token: "tok", source: "file" as const };

beforeEach(() => { vi.restoreAllMocks(); });

describe("client http", () => {
  it("listSessions sends bearer token", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ sessions: [{ id: "s1", title: "hello" }] }), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);
    const c = createClient(cfg);
    const out = await c.listSessions();
    expect(out).toEqual([{ id: "s1", title: "hello" }]);
    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers.Authorization).toBe("Bearer tok");
  });

  it("getHistory returns parsed messages", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ messages: [{ role: "user", text: "hi", at: 1 }] }), { status: 200 })
    ));
    const c = createClient(cfg);
    const msgs = await c.getHistory("s1");
    expect(msgs).toEqual([{ role: "user", text: "hi", at: 1 }]);
  });

  it("health returns ok:true on 200", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("ok", { status: 200 })));
    const c = createClient(cfg);
    expect(await c.health()).toEqual({ ok: true });
  });

  it("health returns ok:false on network error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")));
    const c = createClient(cfg);
    expect(await c.health()).toEqual({ ok: false, reason: "ECONNREFUSED" });
  });
});
```

- [ ] **Step 2: Run, expect FAIL**

```bash
pnpm test lib/openclaw/__tests__/client.http.test.ts
```

- [ ] **Step 3: Implement HTTP portion of `lib/openclaw/client.ts`**

```ts
import type { GatewayConfig } from "./config";
import type { StreamEvent } from "./events";

export type SessionSummary = { id: string; title: string };
export type Message = { role: "user" | "assistant" | "system"; text: string; at: number };

export type Client = {
  listSessions(): Promise<SessionSummary[]>;
  getHistory(sessionId: string): Promise<Message[]>;
  health(): Promise<{ ok: boolean; reason?: string }>;
  sendMessage(sessionId: string, text: string, signal?: AbortSignal): AsyncIterable<StreamEvent>;
};

export function createClient(cfg: GatewayConfig): Client {
  const headers = { Authorization: `Bearer ${cfg.token}` };

  async function listSessions(): Promise<SessionSummary[]> {
    const r = await fetch(`${cfg.url}/sessions`, { headers });
    if (!r.ok) throw new Error(`listSessions ${r.status}`);
    const j = await r.json();
    return j.sessions ?? [];
  }

  async function getHistory(sessionId: string): Promise<Message[]> {
    const r = await fetch(`${cfg.url}/sessions/${encodeURIComponent(sessionId)}/history`, { headers });
    if (!r.ok) throw new Error(`getHistory ${r.status}`);
    const j = await r.json();
    return j.messages ?? [];
  }

  async function health(): Promise<{ ok: boolean; reason?: string }> {
    try {
      const r = await fetch(`${cfg.url}/health`, { headers });
      return r.ok ? { ok: true } : { ok: false, reason: `HTTP ${r.status}` };
    } catch (e) {
      return { ok: false, reason: (e as Error).message };
    }
  }

  // sendMessage implemented in Task 6.
  async function* sendMessage(): AsyncIterable<StreamEvent> {
    throw new Error("not implemented yet");
  }

  return { listSessions, getHistory, health, sendMessage };
}
```

- [ ] **Step 4: Run, expect PASS**

```bash
pnpm test lib/openclaw/__tests__/client.http.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add lib/openclaw/client.ts lib/openclaw/__tests__/client.http.test.ts
git commit -m "feat(openclaw): http client (sessions, history, health)"
```

---

## Task 6: `client.sendMessage` — WebSocket stream → AsyncIterable

**Files:**
- Modify: `lib/openclaw/client.ts`
- Create: `lib/openclaw/__tests__/client.stream.test.ts`, `lib/openclaw/__tests__/fakeWsServer.ts`

- [ ] **Step 1: Install ws**

```bash
pnpm add ws
pnpm add -D @types/ws
```

- [ ] **Step 2: Write a fake WS server helper**

`lib/openclaw/__tests__/fakeWsServer.ts`:

```ts
import { WebSocketServer, type WebSocket } from "ws";
import type { AddressInfo } from "node:net";

export type FakeServer = {
  url: string;
  onConnection: (cb: (ws: WebSocket, req: { headers: Record<string, string> }) => void) => void;
  close: () => Promise<void>;
};

export async function startFakeWs(): Promise<FakeServer> {
  const wss = new WebSocketServer({ port: 0 });
  await new Promise<void>((res) => wss.once("listening", () => res()));
  const port = (wss.address() as AddressInfo).port;
  let handler: ((ws: WebSocket, req: { headers: Record<string, string> }) => void) | null = null;
  wss.on("connection", (ws, req) => {
    handler?.(ws, { headers: req.headers as Record<string, string> });
  });
  return {
    url: `ws://127.0.0.1:${port}`,
    onConnection: (cb) => { handler = cb; },
    close: () => new Promise((res) => wss.close(() => res())),
  };
}
```

- [ ] **Step 3: Write the failing test**

`lib/openclaw/__tests__/client.stream.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createClient } from "../client";
import { startFakeWs, type FakeServer } from "./fakeWsServer";

let server: FakeServer;
beforeEach(async () => { server = await startFakeWs(); });
afterEach(async () => { await server.close(); });

describe("client.sendMessage", () => {
  it("yields events received over websocket and ends on done", async () => {
    server.onConnection((ws, req) => {
      expect(req.headers.authorization).toBe("Bearer tok");
      ws.send(JSON.stringify({ type: "token", text: "he" }));
      ws.send(JSON.stringify({ type: "token", text: "llo" }));
      ws.send(JSON.stringify({ type: "done" }));
    });
    const c = createClient({ url: server.url.replace("ws://", "http://"), token: "tok", source: "file" });
    const events = [];
    for await (const e of c.sendMessage("s1", "hi")) events.push(e);
    expect(events).toEqual([
      { type: "token", text: "he" },
      { type: "token", text: "llo" },
      { type: "done" },
    ]);
  });

  it("emits a single error event when ws closes mid-stream", async () => {
    server.onConnection((ws) => {
      ws.send(JSON.stringify({ type: "token", text: "h" }));
      ws.close();
    });
    const c = createClient({ url: server.url.replace("ws://", "http://"), token: "tok", source: "file" });
    const events = [];
    for await (const e of c.sendMessage("s1", "hi")) events.push(e);
    expect(events.at(0)).toEqual({ type: "token", text: "h" });
    expect(events.at(-1)?.type).toBe("error");
  });

  it("ignores malformed events", async () => {
    server.onConnection((ws) => {
      ws.send("not json");
      ws.send(JSON.stringify({ type: "wat" }));
      ws.send(JSON.stringify({ type: "done" }));
    });
    const c = createClient({ url: server.url.replace("ws://", "http://"), token: "tok", source: "file" });
    const events = [];
    for await (const e of c.sendMessage("s1", "hi")) events.push(e);
    expect(events).toEqual([{ type: "done" }]);
  });
});
```

- [ ] **Step 4: Run, expect FAIL**

```bash
pnpm test lib/openclaw/__tests__/client.stream.test.ts
```

- [ ] **Step 5: Implement WS streaming**

Replace the `sendMessage` stub in `lib/openclaw/client.ts` with:

```ts
import WebSocket from "ws";
import { parseStreamEvent } from "./events";

// ... inside createClient, replace the stub:
async function* sendMessage(
  sessionId: string,
  text: string,
  signal?: AbortSignal,
): AsyncIterable<StreamEvent> {
  const wsUrl = cfg.url.replace(/^http/, "ws") + "/chat";
  const ws = new WebSocket(wsUrl, { headers });

  const queue: StreamEvent[] = [];
  let waiter: ((v: void) => void) | null = null;
  let closed = false;
  let errored = false;

  const wake = () => { waiter?.(); waiter = null; };
  ws.on("open", () => ws.send(JSON.stringify({ sessionId, text })));
  ws.on("message", (data) => {
    let parsed: unknown;
    try { parsed = JSON.parse(data.toString()); } catch { return; }
    const ev = parseStreamEvent(parsed);
    if (!ev) return;
    queue.push(ev);
    if (ev.type === "done" || ev.type === "error") closed = true;
    wake();
  });
  ws.on("close", () => {
    if (!closed) {
      queue.push({ type: "error", message: "connection closed" });
      errored = true;
      closed = true;
    }
    wake();
  });
  ws.on("error", (e) => {
    queue.push({ type: "error", message: (e as Error).message });
    errored = true;
    closed = true;
    wake();
  });
  signal?.addEventListener("abort", () => { try { ws.close(); } catch {} });

  try {
    while (true) {
      while (queue.length) {
        const ev = queue.shift()!;
        yield ev;
        if (ev.type === "done" || ev.type === "error") return;
      }
      if (closed) return;
      await new Promise<void>((res) => { waiter = res; });
    }
  } finally {
    try { ws.close(); } catch {}
    void errored;
  }
}
```

Add `import WebSocket from "ws";` and `import { parseStreamEvent } from "./events";` at the top of the file.

- [ ] **Step 6: Run, expect PASS**

```bash
pnpm test lib/openclaw/__tests__/client.stream.test.ts
```

Expected: 3 passing.

- [ ] **Step 7: Commit**

```bash
git add lib/openclaw/client.ts lib/openclaw/__tests__/client.stream.test.ts lib/openclaw/__tests__/fakeWsServer.ts package.json pnpm-lock.yaml
git commit -m "feat(openclaw): ws stream sendMessage with abort + error mapping"
```

---

## Task 7: Singleton client accessor (`lib/openclaw/index.ts`)

**Files:**
- Create: `lib/openclaw/index.ts`

- [ ] **Step 1: Implement**

```ts
import { loadConfig } from "./config";
import { createClient, type Client } from "./client";

let cached: Client | null | undefined;

export function getClient(): Client | null {
  if (cached === undefined) {
    const cfg = loadConfig();
    cached = cfg ? createClient(cfg) : null;
  }
  return cached;
}

export function __resetClientForTests() { cached = undefined; }

export type { SessionSummary, Message } from "./client";
export type { StreamEvent } from "./events";
```

- [ ] **Step 2: Commit**

```bash
git add lib/openclaw/index.ts
git commit -m "feat(openclaw): cached client singleton"
```

---

## Task 8: `app/api/health/route.ts`

**Files:**
- Create: `app/api/health/route.ts`, `app/api/health/route.test.ts`

- [ ] **Step 1: Write the failing test**

`app/api/health/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/openclaw", () => ({ getClient: vi.fn() }));
import { getClient } from "@/lib/openclaw";
import { GET } from "./route";

beforeEach(() => vi.mocked(getClient).mockReset());

describe("GET /api/health", () => {
  it("returns 503 when no client configured", async () => {
    vi.mocked(getClient).mockReturnValue(null);
    const res = await GET();
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ ok: false, reason: "no-config" });
  });
  it("returns ok:true when gateway healthy", async () => {
    vi.mocked(getClient).mockReturnValue({ health: async () => ({ ok: true }) } as never);
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
  it("returns ok:false reason when gateway down", async () => {
    vi.mocked(getClient).mockReturnValue({ health: async () => ({ ok: false, reason: "ECONNREFUSED" }) } as never);
    const res = await GET();
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ ok: false, reason: "ECONNREFUSED" });
  });
});
```

- [ ] **Step 2: Run, expect FAIL**

```bash
pnpm test app/api/health/route.test.ts
```

- [ ] **Step 3: Implement `app/api/health/route.ts`**

```ts
import { NextResponse } from "next/server";
import { getClient } from "@/lib/openclaw";

export async function GET() {
  const c = getClient();
  if (!c) return NextResponse.json({ ok: false, reason: "no-config" }, { status: 503 });
  const r = await c.health();
  return NextResponse.json(r, { status: r.ok ? 200 : 503 });
}
```

- [ ] **Step 4: Run, expect PASS**

```bash
pnpm test app/api/health/route.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add app/api/health/
git commit -m "feat(api): health route"
```

---

## Task 9: `app/api/sessions/route.ts` and `app/api/sessions/[id]/route.ts`

**Files:**
- Create: `app/api/sessions/route.ts`, `app/api/sessions/[id]/route.ts`, `app/api/sessions/route.test.ts`

- [ ] **Step 1: Write the failing test**

`app/api/sessions/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/openclaw", () => ({ getClient: vi.fn() }));
import { getClient } from "@/lib/openclaw";
import { GET as listGET } from "./route";
import { GET as historyGET } from "./[id]/route";

beforeEach(() => vi.mocked(getClient).mockReset());

describe("sessions routes", () => {
  it("list returns 503 with no config", async () => {
    vi.mocked(getClient).mockReturnValue(null);
    const r = await listGET();
    expect(r.status).toBe(503);
  });
  it("list returns sessions array", async () => {
    vi.mocked(getClient).mockReturnValue({ listSessions: async () => [{ id: "s1", title: "t" }] } as never);
    const r = await listGET();
    expect(await r.json()).toEqual({ sessions: [{ id: "s1", title: "t" }] });
  });
  it("history returns 503 with no config", async () => {
    vi.mocked(getClient).mockReturnValue(null);
    const r = await historyGET(new Request("http://x"), { params: Promise.resolve({ id: "s1" }) });
    expect(r.status).toBe(503);
  });
  it("history returns messages array", async () => {
    vi.mocked(getClient).mockReturnValue({ getHistory: async () => [{ role: "user", text: "hi", at: 1 }] } as never);
    const r = await historyGET(new Request("http://x"), { params: Promise.resolve({ id: "s1" }) });
    expect(await r.json()).toEqual({ messages: [{ role: "user", text: "hi", at: 1 }] });
  });
});
```

- [ ] **Step 2: Run, expect FAIL**

```bash
pnpm test app/api/sessions/route.test.ts
```

- [ ] **Step 3: Implement**

`app/api/sessions/route.ts`:

```ts
import { NextResponse } from "next/server";
import { getClient } from "@/lib/openclaw";

export async function GET() {
  const c = getClient();
  if (!c) return NextResponse.json({ error: "no-config" }, { status: 503 });
  const sessions = await c.listSessions();
  return NextResponse.json({ sessions });
}
```

`app/api/sessions/[id]/route.ts`:

```ts
import { NextResponse } from "next/server";
import { getClient } from "@/lib/openclaw";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const c = getClient();
  if (!c) return NextResponse.json({ error: "no-config" }, { status: 503 });
  const { id } = await ctx.params;
  const messages = await c.getHistory(id);
  return NextResponse.json({ messages });
}
```

- [ ] **Step 4: Run, expect PASS**

```bash
pnpm test app/api/sessions/route.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add app/api/sessions/
git commit -m "feat(api): sessions list + history routes"
```

---

## Task 10: `app/api/chat/route.ts` — SSE proxy of stream events

**Files:**
- Create: `app/api/chat/route.ts`, `app/api/chat/route.test.ts`

- [ ] **Step 1: Write the failing test**

`app/api/chat/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/openclaw", () => ({ getClient: vi.fn() }));
import { getClient } from "@/lib/openclaw";
import { POST } from "./route";

beforeEach(() => vi.mocked(getClient).mockReset());

async function readSse(res: Response): Promise<string> {
  const reader = res.body!.getReader();
  const dec = new TextDecoder();
  let out = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    out += dec.decode(value);
  }
  return out;
}

describe("POST /api/chat", () => {
  it("returns 503 when no client", async () => {
    vi.mocked(getClient).mockReturnValue(null);
    const r = await POST(new Request("http://x", { method: "POST", body: JSON.stringify({ sessionId: "s", text: "hi" }) }));
    expect(r.status).toBe(503);
  });

  it("streams events as SSE frames", async () => {
    vi.mocked(getClient).mockReturnValue({
      async *sendMessage() {
        yield { type: "token", text: "hi" } as const;
        yield { type: "done" } as const;
      },
    } as never);
    const r = await POST(new Request("http://x", { method: "POST", body: JSON.stringify({ sessionId: "s", text: "hi" }) }));
    expect(r.headers.get("content-type")).toContain("text/event-stream");
    const body = await readSse(r);
    expect(body).toContain("event: token");
    expect(body).toContain('data: {"type":"token","text":"hi"}');
    expect(body).toContain("event: done");
  });

  it("rejects malformed body with 400", async () => {
    vi.mocked(getClient).mockReturnValue({} as never);
    const r = await POST(new Request("http://x", { method: "POST", body: "{}" }));
    expect(r.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run, expect FAIL**

```bash
pnpm test app/api/chat/route.test.ts
```

- [ ] **Step 3: Implement**

`app/api/chat/route.ts`:

```ts
import { z } from "zod";
import { getClient } from "@/lib/openclaw";

const Body = z.object({ sessionId: z.string().min(1), text: z.string().min(1) });

export async function POST(req: Request) {
  const c = getClient();
  if (!c) return new Response(JSON.stringify({ error: "no-config" }), { status: 503 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return new Response(JSON.stringify({ error: "bad-body" }), { status: 400 });

  const ac = new AbortController();
  req.signal.addEventListener("abort", () => ac.abort());

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const enc = new TextEncoder();
      try {
        for await (const ev of c.sendMessage(parsed.data.sessionId, parsed.data.text, ac.signal)) {
          controller.enqueue(enc.encode(`event: ${ev.type}\ndata: ${JSON.stringify(ev)}\n\n`));
          if (ev.type === "done" || ev.type === "error") break;
        }
      } catch (e) {
        const msg = (e as Error).message;
        controller.enqueue(enc.encode(`event: error\ndata: ${JSON.stringify({ type: "error", message: msg })}\n\n`));
      } finally {
        controller.close();
      }
    },
    cancel() { ac.abort(); },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      "x-accel-buffering": "no",
      connection: "keep-alive",
    },
  });
}
```

- [ ] **Step 4: Run, expect PASS**

```bash
pnpm test app/api/chat/route.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add app/api/chat/
git commit -m "feat(api): chat SSE route proxying gateway stream"
```

---

## Task 11: `hooks/useChat.ts` — client-side chat state machine

The `/api/chat` route is POST + SSE response, so we use streaming `fetch` with a ReadableStream reader and parse SSE frames manually (`EventSource` only supports GET).

**Files:**
- Create: `hooks/useChat.ts`, `hooks/sseParse.ts`, `hooks/useChat.test.tsx`, `hooks/sseParse.test.ts`

- [ ] **Step 1: Write the failing SSE-parser test**

`hooks/sseParse.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { parseSseChunks } from "./sseParse";

describe("parseSseChunks", () => {
  it("yields complete frames split across chunks", () => {
    const out: { event: string; data: string }[] = [];
    const push = (f: { event: string; data: string }) => out.push(f);
    const p = parseSseChunks(push);
    p.feed("event: token\ndata: ");
    p.feed('{"type":"token","text":"hi"}\n\nevent: done\ndata: {"type":"done"}\n\n');
    expect(out).toEqual([
      { event: "token", data: '{"type":"token","text":"hi"}' },
      { event: "done", data: '{"type":"done"}' },
    ]);
  });
  it("ignores frames without event/data", () => {
    const out: { event: string; data: string }[] = [];
    const p = parseSseChunks((f) => out.push(f));
    p.feed(": comment\n\nevent: x\n\n");
    expect(out).toEqual([]);
  });
});
```

- [ ] **Step 2: Implement `hooks/sseParse.ts`**

```ts
export function parseSseChunks(onFrame: (f: { event: string; data: string }) => void) {
  let buf = "";
  return {
    feed(chunk: string) {
      buf += chunk;
      let idx: number;
      while ((idx = buf.indexOf("\n\n")) >= 0) {
        const raw = buf.slice(0, idx);
        buf = buf.slice(idx + 2);
        let event = "";
        const dataLines: string[] = [];
        for (const line of raw.split("\n")) {
          if (line.startsWith("event:")) event = line.slice(6).trim();
          else if (line.startsWith("data:")) dataLines.push(line.slice(5).trimStart());
        }
        if (event && dataLines.length) onFrame({ event, data: dataLines.join("\n") });
      }
    },
  };
}
```

- [ ] **Step 3: Run, expect PASS**

```bash
pnpm test hooks/sseParse.test.ts
```

- [ ] **Step 4: Write the failing useChat test**

`hooks/useChat.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useChat } from "./useChat";

function streamFromFrames(frames: { event: string; data: unknown }[]): Response {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      const enc = new TextEncoder();
      for (const f of frames) {
        controller.enqueue(enc.encode(`event: ${f.event}\ndata: ${JSON.stringify(f.data)}\n\n`));
      }
      controller.close();
    },
  });
  return new Response(body, { status: 200, headers: { "content-type": "text/event-stream" } });
}

beforeEach(() => { vi.unstubAllGlobals(); });

describe("useChat", () => {
  it("optimistically appends user message and streams assistant tokens", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(streamFromFrames([
      { event: "token", data: { type: "token", text: "he" } },
      { event: "token", data: { type: "token", text: "llo" } },
      { event: "done", data: { type: "done" } },
    ])));
    const { result } = renderHook(() => useChat("s1"));
    await act(async () => { await result.current.send("hi"); });
    await waitFor(() => {
      expect(result.current.status).toBe("idle");
      const last = result.current.messages.at(-1)!;
      expect(last.role).toBe("assistant");
      expect(last.blocks).toEqual([{ kind: "text", md: "hello" }]);
    });
    expect(result.current.messages.at(-2)).toMatchObject({ role: "user", blocks: [{ kind: "text", md: "hi" }] });
  });

  it("interleaves tool_call / tool_result blocks with text", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(streamFromFrames([
      { event: "token", data: { type: "token", text: "before " } },
      { event: "tool_call", data: { type: "tool_call", id: "t1", name: "search", args: { q: "x" } } },
      { event: "tool_result", data: { type: "tool_result", id: "t1", result: "found" } },
      { event: "token", data: { type: "token", text: "after" } },
      { event: "done", data: { type: "done" } },
    ])));
    const { result } = renderHook(() => useChat("s1"));
    await act(async () => { await result.current.send("hi"); });
    await waitFor(() => {
      const last = result.current.messages.at(-1)!;
      expect(last.blocks.map((b) => b.kind)).toEqual(["text", "tool_call", "text"]);
      expect(result.current.status).toBe("idle");
    });
  });

  it("marks message errored on error event", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(streamFromFrames([
      { event: "error", data: { type: "error", message: "boom" } },
    ])));
    const { result } = renderHook(() => useChat("s1"));
    await act(async () => { await result.current.send("hi"); });
    await waitFor(() => {
      expect(result.current.messages.at(-1)?.error).toBe("boom");
      expect(result.current.status).toBe("error");
    });
  });
});
```

- [ ] **Step 5: Run, expect FAIL**

```bash
pnpm test hooks/useChat.test.tsx
```

- [ ] **Step 6: Implement `hooks/useChat.ts`**

```ts
"use client";
import { useCallback, useRef, useState } from "react";
import { parseSseChunks } from "./sseParse";

export type Block =
  | { kind: "text"; md: string }
  | { kind: "tool_call"; id: string; name: string; args: unknown; result?: unknown; error?: string; done: boolean }
  | { kind: "thinking"; text: string; done: boolean };

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  blocks: Block[];
  error?: string;
};

export type Status = "idle" | "streaming" | "error";

export function useChat(sessionId: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const abortRef = useRef<AbortController | null>(null);
  const idRef = useRef(0);
  const newId = () => `m-${++idRef.current}`;

  const updateLast = useCallback((fn: (m: ChatMessage) => ChatMessage) => {
    setMessages((ms) => {
      if (!ms.length) return ms;
      const copy = ms.slice();
      copy[copy.length - 1] = fn(copy[copy.length - 1]);
      return copy;
    });
  }, []);

  const handleEvent = useCallback((event: string, data: unknown) => {
    const d = data as Record<string, unknown>;
    if (event === "token") {
      const text = String(d.text ?? "");
      updateLast((m) => {
        const blocks = m.blocks.slice();
        const last = blocks.at(-1);
        if (last?.kind === "text") blocks[blocks.length - 1] = { kind: "text", md: last.md + text };
        else blocks.push({ kind: "text", md: text });
        return { ...m, blocks };
      });
    } else if (event === "thinking") {
      const text = String(d.text ?? "");
      updateLast((m) => {
        const blocks = m.blocks.slice();
        const last = blocks.at(-1);
        if (last?.kind === "thinking" && !last.done) blocks[blocks.length - 1] = { ...last, text: last.text + text };
        else blocks.push({ kind: "thinking", text, done: false });
        return { ...m, blocks };
      });
    } else if (event === "tool_call") {
      updateLast((m) => ({
        ...m,
        blocks: [...m.blocks, { kind: "tool_call", id: String(d.id), name: String(d.name), args: d.args, done: false }],
      }));
    } else if (event === "tool_result") {
      updateLast((m) => ({
        ...m,
        blocks: m.blocks.map((b) =>
          b.kind === "tool_call" && b.id === d.id
            ? { ...b, result: d.result, error: d.error as string | undefined, done: true }
            : b,
        ),
      }));
    } else if (event === "done") {
      updateLast((m) => ({
        ...m,
        blocks: m.blocks.map((b) => (b.kind === "thinking" ? { ...b, done: true } : b)),
      }));
      setStatus("idle");
    } else if (event === "error") {
      updateLast((m) => ({ ...m, error: String(d.message ?? "stream error") }));
      setStatus("error");
    }
  }, [updateLast]);

  const send = useCallback(async (text: string) => {
    const userMsg: ChatMessage = { id: newId(), role: "user", blocks: [{ kind: "text", md: text }] };
    const asst: ChatMessage = { id: newId(), role: "assistant", blocks: [] };
    setMessages((ms) => [...ms, userMsg, asst]);
    setStatus("streaming");

    const ac = new AbortController();
    abortRef.current = ac;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId, text }),
        signal: ac.signal,
      });
      if (!res.ok || !res.body) {
        handleEvent("error", { message: `HTTP ${res.status}` });
        return;
      }
      const parser = parseSseChunks(({ event, data }) => {
        try { handleEvent(event, JSON.parse(data)); } catch { /* ignore malformed */ }
      });
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        parser.feed(dec.decode(value, { stream: true }));
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        handleEvent("error", { message: (e as Error).message });
      }
    }
  }, [handleEvent, sessionId]);

  return { messages, status, send };
}
```

- [ ] **Step 7: Run, expect PASS**

```bash
pnpm test hooks/
```

Expected: 5 passing (2 sseParse + 3 useChat).

- [ ] **Step 8: Commit**

```bash
git add hooks/
git commit -m "feat(hooks): useChat streaming via fetch + manual SSE parser"
```

---

## Task 12: `components/render/Markdown.tsx`

**Files:**
- Create: `components/render/Markdown.tsx`, `components/render/Markdown.test.tsx`

- [ ] **Step 1: Install rendering deps**

```bash
pnpm add react-markdown remark-gfm remark-math rehype-katex shiki katex
pnpm add -D @types/react @types/react-dom
```

- [ ] **Step 2: Write the failing test**

`components/render/Markdown.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Markdown } from "./Markdown";

describe("Markdown", () => {
  it("renders headings and inline code", () => {
    render(<Markdown md={"# Hello\n\nThis is `inline`."} />);
    expect(screen.getByRole("heading", { level: 1, name: "Hello" })).toBeInTheDocument();
    expect(screen.getByText("inline")).toBeInTheDocument();
  });
  it("renders GFM tables", () => {
    render(<Markdown md={"| a | b |\n|---|---|\n| 1 | 2 |"} />);
    expect(screen.getByRole("table")).toBeInTheDocument();
  });
  it("renders block math via KaTeX", () => {
    const { container } = render(<Markdown md={"$$x^2$$"} />);
    expect(container.querySelector(".katex")).not.toBeNull();
  });
  it("does not render raw HTML by default", () => {
    const { container } = render(<Markdown md={"<script>alert(1)</script>"} />);
    expect(container.querySelector("script")).toBeNull();
  });
});
```

- [ ] **Step 3: Run, expect FAIL**

```bash
pnpm test components/render/Markdown.test.tsx
```

- [ ] **Step 4: Implement `components/render/Markdown.tsx`**

```tsx
"use client";
import { memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

type Props = { md: string };

function MarkdownInner({ md }: Props) {
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          a: (props) => <a {...props} target="_blank" rel="noopener noreferrer" />,
          img: (props) => (
            // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
            <img {...props} loading="lazy" referrerPolicy="no-referrer" className="max-w-full rounded" />
          ),
          code({ className, children, ...rest }) {
            const text = String(children).replace(/\n$/, "");
            const isBlock = /language-/.test(className ?? "");
            if (!isBlock) return <code className={className} {...rest}>{text}</code>;
            return (
              <pre className="rounded-md p-3 overflow-x-auto bg-zinc-900 text-zinc-100 text-sm">
                <code className={className}>{text}</code>
              </pre>
            );
          },
        }}
      >
        {md}
      </ReactMarkdown>
    </div>
  );
}

export const Markdown = memo(MarkdownInner);
```

> Syntax highlighting via Shiki is added in Task 13 to keep this task focused. For now, code blocks render plain inside a styled `<pre>`.

- [ ] **Step 5: Run, expect PASS**

```bash
pnpm test components/render/Markdown.test.tsx
```

- [ ] **Step 6: Commit**

```bash
git add components/render/ package.json pnpm-lock.yaml
git commit -m "feat(render): markdown with GFM + KaTeX, html disabled"
```

---

## Task 13: Shiki syntax highlighting in Markdown code blocks

**Files:**
- Create: `components/render/CodeBlock.tsx`, `components/render/CodeBlock.test.tsx`
- Modify: `components/render/Markdown.tsx`

- [ ] **Step 1: Write the failing test**

`components/render/CodeBlock.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { CodeBlock } from "./CodeBlock";

describe("CodeBlock", () => {
  it("renders highlighted output for typescript", async () => {
    const { container } = render(<CodeBlock lang="ts" code={"const x: number = 1;"} />);
    await waitFor(() => {
      expect(container.querySelector("pre.shiki")).not.toBeNull();
    });
  });
  it("falls back to plain pre for unknown language", async () => {
    const { container } = render(<CodeBlock lang="zzz" code={"hello"} />);
    await waitFor(() => {
      expect(container.querySelector("pre")).not.toBeNull();
    });
  });
});
```

- [ ] **Step 2: Run, expect FAIL**

```bash
pnpm test components/render/CodeBlock.test.tsx
```

- [ ] **Step 3: Implement `components/render/CodeBlock.tsx`**

```tsx
"use client";
import { useEffect, useState } from "react";
import { codeToHtml } from "shiki";

type Props = { lang: string; code: string };

export function CodeBlock({ lang, code }: Props) {
  const [html, setHtml] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    codeToHtml(code, { lang, theme: "github-dark" })
      .then((h) => { if (!cancelled) setHtml(h); })
      .catch(() => { if (!cancelled) setHtml(null); });
    return () => { cancelled = true; };
  }, [code, lang]);

  if (html) return <div className="text-sm" dangerouslySetInnerHTML={{ __html: html }} />;
  return (
    <pre className="rounded-md p-3 overflow-x-auto bg-zinc-900 text-zinc-100 text-sm">
      <code>{code}</code>
    </pre>
  );
}
```

- [ ] **Step 4: Wire into Markdown**

In `components/render/Markdown.tsx`, replace the `code` component renderer with:

```tsx
import { CodeBlock } from "./CodeBlock";
// ...
code({ className, children, ...rest }) {
  const text = String(children).replace(/\n$/, "");
  const m = /language-(\w+)/.exec(className ?? "");
  if (!m) return <code className={className} {...rest}>{text}</code>;
  return <CodeBlock lang={m[1]} code={text} />;
},
```

- [ ] **Step 5: Run, expect PASS**

```bash
pnpm test components/render/
```

- [ ] **Step 6: Commit**

```bash
git add components/render/
git commit -m "feat(render): shiki syntax highlighting for fenced code"
```

---

## Task 14: Agent-trace components (`ToolCallPanel`, `ThinkingPanel`)

**Files:**
- Create: `components/agent-trace/ToolCallPanel.tsx`, `components/agent-trace/ThinkingPanel.tsx`, plus colocated tests

- [ ] **Step 1: Write the failing tests**

`components/agent-trace/ToolCallPanel.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ToolCallPanel } from "./ToolCallPanel";

describe("ToolCallPanel", () => {
  it("shows pending state while not done", () => {
    render(<ToolCallPanel name="search" args={{ q: "x" }} done={false} />);
    expect(screen.getByText(/search/)).toBeInTheDocument();
    expect(screen.getByText(/running/i)).toBeInTheDocument();
  });
  it("expands to show args + result when toggled", async () => {
    render(<ToolCallPanel name="search" args={{ q: "x" }} done={true} result="found" />);
    await userEvent.click(screen.getByRole("button"));
    expect(screen.getByText(/"q": "x"/)).toBeInTheDocument();
    expect(screen.getByText("found")).toBeInTheDocument();
  });
});
```

`components/agent-trace/ThinkingPanel.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThinkingPanel } from "./ThinkingPanel";

describe("ThinkingPanel", () => {
  it('says "Thinking…" while not done', () => {
    render(<ThinkingPanel text="hmm" done={false} />);
    expect(screen.getByText(/thinking/i)).toBeInTheDocument();
  });
  it("reveals text when expanded", async () => {
    render(<ThinkingPanel text="weighing options" done={true} />);
    await userEvent.click(screen.getByRole("button"));
    expect(screen.getByText("weighing options")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run, expect FAIL**

```bash
pnpm test components/agent-trace/
```

- [ ] **Step 3: Implement `components/agent-trace/ToolCallPanel.tsx`**

```tsx
"use client";
import { useState } from "react";

type Props = { name: string; args: unknown; done: boolean; result?: unknown; error?: string };

export function ToolCallPanel({ name, args, done, result, error }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <div className="my-2 border rounded-md text-sm">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-3 py-2 text-left"
      >
        <span>
          <span className="font-mono">{name}</span>
          {" "}
          <span className="text-zinc-500">
            {error ? "error" : done ? "done" : "running…"}
          </span>
        </span>
        <span aria-hidden>{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-2">
          <pre className="text-xs bg-zinc-100 dark:bg-zinc-800 p-2 rounded overflow-x-auto">
            {JSON.stringify(args, null, 2)}
          </pre>
          {done && (
            <pre className="text-xs bg-zinc-100 dark:bg-zinc-800 p-2 rounded overflow-x-auto">
              {error ?? (typeof result === "string" ? result : JSON.stringify(result, null, 2))}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Implement `components/agent-trace/ThinkingPanel.tsx`**

```tsx
"use client";
import { useState } from "react";

type Props = { text: string; done: boolean };

export function ThinkingPanel({ text, done }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <div className="my-2 border-l-2 border-zinc-300 dark:border-zinc-700 pl-3 text-sm">
      <button type="button" onClick={() => setOpen((o) => !o)} className="text-zinc-500">
        {done ? "Thoughts" : "Thinking…"} {open ? "▾" : "▸"}
      </button>
      {open && <div className="mt-1 whitespace-pre-wrap text-zinc-600 dark:text-zinc-400">{text}</div>}
    </div>
  );
}
```

- [ ] **Step 5: Run, expect PASS**

```bash
pnpm test components/agent-trace/
```

- [ ] **Step 6: Commit**

```bash
git add components/agent-trace/
git commit -m "feat(trace): collapsible tool-call + thinking panels"
```

---

## Task 15: Chat components (`Message`, `StreamingMessage`, `MessageList`, `Composer`)

**Files:**
- Create: `components/chat/Message.tsx`, `components/chat/StreamingMessage.tsx`, `components/chat/MessageList.tsx`, `components/chat/Composer.tsx`, plus tests for `Message` and `Composer`

- [ ] **Step 1: Write the failing tests**

`components/chat/Message.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Message } from "./Message";

describe("Message", () => {
  it("renders text block as markdown", () => {
    render(<Message message={{
      id: "m1", role: "assistant", blocks: [{ kind: "text", md: "**hi**" }],
    }} />);
    expect(screen.getByText("hi").tagName).toBe("STRONG");
  });
  it("renders tool_call block via ToolCallPanel", () => {
    render(<Message message={{
      id: "m1", role: "assistant",
      blocks: [{ kind: "tool_call", id: "t", name: "search", args: {}, done: true, result: "ok" }],
    }} />);
    expect(screen.getByText("search")).toBeInTheDocument();
  });
  it("renders thinking block via ThinkingPanel", () => {
    render(<Message message={{
      id: "m1", role: "assistant", blocks: [{ kind: "thinking", text: "x", done: true }],
    }} />);
    expect(screen.getByText(/Thoughts/)).toBeInTheDocument();
  });
  it("shows error footer when message errored", () => {
    render(<Message message={{
      id: "m1", role: "assistant", blocks: [], error: "boom",
    }} />);
    expect(screen.getByText(/boom/)).toBeInTheDocument();
  });
});
```

`components/chat/Composer.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Composer } from "./Composer";

describe("Composer", () => {
  it("submits on click", async () => {
    const onSend = vi.fn();
    render(<Composer onSend={onSend} disabled={false} />);
    await userEvent.type(screen.getByRole("textbox"), "hello");
    await userEvent.click(screen.getByRole("button", { name: /send/i }));
    expect(onSend).toHaveBeenCalledWith("hello");
  });
  it("submits on Cmd/Ctrl-Enter", async () => {
    const onSend = vi.fn();
    render(<Composer onSend={onSend} disabled={false} />);
    const ta = screen.getByRole("textbox");
    await userEvent.type(ta, "hi");
    await userEvent.keyboard("{Control>}{Enter}{/Control}");
    expect(onSend).toHaveBeenCalledWith("hi");
  });
  it("is disabled when prop is true", () => {
    render(<Composer onSend={() => {}} disabled />);
    expect(screen.getByRole("textbox")).toBeDisabled();
    expect(screen.getByRole("button", { name: /send/i })).toBeDisabled();
  });
});
```

- [ ] **Step 2: Run, expect FAIL**

```bash
pnpm test components/chat/
```

- [ ] **Step 3: Implement `components/chat/Message.tsx`**

```tsx
"use client";
import type { ChatMessage } from "@/hooks/useChat";
import { Markdown } from "@/components/render/Markdown";
import { ToolCallPanel } from "@/components/agent-trace/ToolCallPanel";
import { ThinkingPanel } from "@/components/agent-trace/ThinkingPanel";

export function Message({ message }: { message: ChatMessage }) {
  const align = message.role === "user" ? "items-end" : "items-start";
  return (
    <div className={`flex flex-col ${align} my-3`}>
      <div className={`max-w-[80%] rounded-2xl px-4 py-2 ${
        message.role === "user" ? "bg-blue-600 text-white" : "bg-zinc-100 dark:bg-zinc-800"
      }`}>
        {message.blocks.map((b, i) => {
          if (b.kind === "text") return <Markdown key={i} md={b.md} />;
          if (b.kind === "tool_call") return (
            <ToolCallPanel key={i} name={b.name} args={b.args} done={b.done} result={b.result} error={b.error} />
          );
          return <ThinkingPanel key={i} text={b.text} done={b.done} />;
        })}
        {message.error && <div className="text-sm text-red-500 mt-2">Error: {message.error}</div>}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Implement `components/chat/StreamingMessage.tsx`** (currently same as `Message`; kept distinct so future polish like a typing indicator lands here without touching `Message`)

```tsx
"use client";
import type { ChatMessage } from "@/hooks/useChat";
import { Message } from "./Message";

export function StreamingMessage({ message }: { message: ChatMessage }) {
  return (
    <div className="relative">
      <Message message={message} />
      <span className="absolute -bottom-1 left-4 text-xs text-zinc-400 animate-pulse">streaming…</span>
    </div>
  );
}
```

- [ ] **Step 5: Implement `components/chat/MessageList.tsx`**

```tsx
"use client";
import { useEffect, useRef } from "react";
import type { ChatMessage, Status } from "@/hooks/useChat";
import { Message } from "./Message";
import { StreamingMessage } from "./StreamingMessage";

export function MessageList({ messages, status }: { messages: ChatMessage[]; status: Status }) {
  const endRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);
  return (
    <div className="flex-1 overflow-y-auto px-4">
      {messages.map((m, i) => {
        const isLastAssistant = m.role === "assistant" && i === messages.length - 1;
        if (isLastAssistant && status === "streaming") return <StreamingMessage key={m.id} message={m} />;
        return <Message key={m.id} message={m} />;
      })}
      <div ref={endRef} />
    </div>
  );
}
```

- [ ] **Step 6: Implement `components/chat/Composer.tsx`**

```tsx
"use client";
import { useState, type KeyboardEvent } from "react";

type Props = { onSend: (text: string) => void; disabled: boolean };

export function Composer({ onSend, disabled }: Props) {
  const [text, setText] = useState("");
  const submit = () => {
    const t = text.trim();
    if (!t || disabled) return;
    onSend(t);
    setText("");
  };
  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); submit(); }
  };
  return (
    <div className="border-t p-3 flex gap-2">
      <textarea
        className="flex-1 resize-none rounded-md border p-2 bg-transparent disabled:opacity-50"
        rows={2}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKeyDown}
        disabled={disabled}
        placeholder={disabled ? "Gateway unavailable" : "Message… (⌘/Ctrl-Enter to send)"}
      />
      <button
        type="button"
        onClick={submit}
        disabled={disabled || !text.trim()}
        className="px-4 rounded-md bg-blue-600 text-white disabled:opacity-50"
      >
        Send
      </button>
    </div>
  );
}
```

- [ ] **Step 7: Run, expect PASS**

```bash
pnpm test components/chat/
```

- [ ] **Step 8: Commit**

```bash
git add components/chat/
git commit -m "feat(chat): Message, StreamingMessage, MessageList, Composer"
```

---

## Task 16: `components/connection/StatusBanner.tsx`

**Files:**
- Create: `components/connection/StatusBanner.tsx`, `components/connection/StatusBanner.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { StatusBanner } from "./StatusBanner";

beforeEach(() => vi.useFakeTimers());

describe("StatusBanner", () => {
  it("hides when healthy", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 })));
    render(<StatusBanner />);
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
  });
  it("shows banner when unhealthy", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: false, reason: "x" }), { status: 503 })));
    render(<StatusBanner />);
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
  });
});
```

- [ ] **Step 2: Run, expect FAIL**

```bash
pnpm test components/connection/
```

- [ ] **Step 3: Implement**

```tsx
"use client";
import { useEffect, useState } from "react";

export function StatusBanner() {
  const [state, setState] = useState<{ ok: boolean; reason?: string } | null>(null);
  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const r = await fetch("/api/health");
        const j = await r.json();
        if (!cancelled) setState(j);
      } catch {
        if (!cancelled) setState({ ok: false, reason: "fetch failed" });
      }
    };
    tick();
    const id = setInterval(tick, 10_000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);
  if (!state || state.ok) return null;
  return (
    <div role="alert" className="bg-red-600 text-white text-sm px-3 py-2">
      openclaw gateway unreachable{state.reason ? ` — ${state.reason}` : ""}
    </div>
  );
}
```

- [ ] **Step 4: Run, expect PASS**

```bash
pnpm test components/connection/
```

- [ ] **Step 5: Commit**

```bash
git add components/connection/
git commit -m "feat(connection): StatusBanner polling /api/health"
```

---

## Task 17: Main page `app/page.tsx` and setup fallback `app/setup/page.tsx`

**Files:**
- Modify: `app/page.tsx`, `app/layout.tsx`, `app/globals.css`
- Create: `app/setup/page.tsx`

- [ ] **Step 1: Update `app/layout.tsx`**

```tsx
import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "clawapp", description: "openclaw chat" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="h-screen bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 2: Implement `app/page.tsx`**

```tsx
import { redirect } from "next/navigation";
import { getClient } from "@/lib/openclaw";
import { ChatPage } from "./ChatPage";

export default async function Page() {
  const c = getClient();
  if (!c) redirect("/setup");
  const sessions = await c.listSessions().catch(() => []);
  const initial = sessions[0];
  return <ChatPage initialSessionId={initial?.id ?? null} sessions={sessions} />;
}
```

- [ ] **Step 3: Create `app/ChatPage.tsx`** (client component)

```tsx
"use client";
import { useState } from "react";
import { useChat } from "@/hooks/useChat";
import { MessageList } from "@/components/chat/MessageList";
import { Composer } from "@/components/chat/Composer";
import { StatusBanner } from "@/components/connection/StatusBanner";
import type { SessionSummary } from "@/lib/openclaw";

type Props = { initialSessionId: string | null; sessions: SessionSummary[] };

export function ChatPage({ initialSessionId, sessions }: Props) {
  const [sessionId, setSessionId] = useState(initialSessionId ?? "default");
  const { messages, status, send } = useChat(sessionId);

  return (
    <div className="h-full flex flex-col">
      <StatusBanner />
      <div className="flex-1 flex overflow-hidden">
        <aside className="w-64 border-r overflow-y-auto p-2 hidden md:block">
          <div className="text-xs uppercase text-zinc-500 px-2 py-1">Sessions</div>
          {sessions.length === 0 && <div className="px-2 text-sm text-zinc-500">No sessions yet</div>}
          {sessions.map((s) => (
            <button
              key={s.id}
              onClick={() => setSessionId(s.id)}
              className={`w-full text-left px-2 py-1 rounded text-sm truncate ${
                s.id === sessionId ? "bg-zinc-200 dark:bg-zinc-800" : "hover:bg-zinc-100 dark:hover:bg-zinc-900"
              }`}
            >
              {s.title || s.id}
            </button>
          ))}
        </aside>
        <main className="flex-1 flex flex-col">
          <MessageList messages={messages} status={status} />
          <Composer onSend={send} disabled={status === "streaming"} />
        </main>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Implement `app/setup/page.tsx`**

```tsx
export default function SetupPage() {
  return (
    <div className="max-w-xl mx-auto p-8 space-y-4">
      <h1 className="text-2xl font-semibold">clawapp setup</h1>
      <p>The app could not find your openclaw gateway configuration.</p>
      <ol className="list-decimal list-inside space-y-2 text-sm">
        <li>Make sure openclaw is installed at <code>~/.openclaw/</code> and has run at least once.</li>
        <li>Confirm <code>~/.openclaw/openclaw.json</code> is readable and contains <code>gateway.port</code> and <code>gateway.auth.token</code>.</li>
        <li>Or set the env vars <code>OPENCLAW_GATEWAY_URL</code> and <code>OPENCLAW_TOKEN</code> and restart the app.</li>
      </ol>
      <p className="text-sm text-zinc-500">Then refresh this page.</p>
    </div>
  );
}
```

- [ ] **Step 5: Verify the app boots**

```bash
pnpm dev &
sleep 5
curl -sf http://localhost:3000/setup > /dev/null && echo "setup OK"
kill %1
```

- [ ] **Step 6: Commit**

```bash
git add app/
git commit -m "feat(app): main chat page + setup fallback"
```

---

## Task 18: Playwright smoke test against a fake gateway

**Files:**
- Create: `e2e/chat.spec.ts`, `e2e/fixtures/gateway.ts`
- Modify: `playwright.config.ts` (env to point app at fake gateway)

- [ ] **Step 1: Write fake gateway fixture**

`e2e/fixtures/gateway.ts`:

```ts
import http from "node:http";
import { WebSocketServer } from "ws";

export async function startFakeGateway(port: number, token: string) {
  const server = http.createServer((req, res) => {
    if (req.headers.authorization !== `Bearer ${token}`) {
      res.statusCode = 401; res.end(); return;
    }
    if (req.url === "/health") { res.statusCode = 200; res.end("ok"); return; }
    if (req.url === "/sessions") {
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ sessions: [{ id: "s1", title: "Test" }] }));
      return;
    }
    if (req.url?.startsWith("/sessions/")) {
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ messages: [] }));
      return;
    }
    res.statusCode = 404; res.end();
  });
  const wss = new WebSocketServer({ server, path: "/chat" });
  wss.on("connection", (ws, req) => {
    if (req.headers.authorization !== `Bearer ${token}`) { ws.close(); return; }
    ws.on("message", () => {
      ws.send(JSON.stringify({ type: "token", text: "hello " }));
      ws.send(JSON.stringify({ type: "tool_call", id: "t1", name: "search", args: { q: "x" } }));
      ws.send(JSON.stringify({ type: "tool_result", id: "t1", result: "ok" }));
      ws.send(JSON.stringify({ type: "token", text: "world" }));
      ws.send(JSON.stringify({ type: "done" }));
    });
  });
  await new Promise<void>((res) => server.listen(port, "127.0.0.1", () => res()));
  return () => new Promise<void>((res) => server.close(() => res()));
}
```

- [ ] **Step 2: Update `playwright.config.ts` to set env vars**

```ts
import { defineConfig } from "@playwright/test";

const PORT = 39789;
const TOKEN = "test-token";

export default defineConfig({
  testDir: "./e2e",
  use: { baseURL: "http://localhost:3000" },
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    env: {
      OPENCLAW_GATEWAY_URL: `http://127.0.0.1:${PORT}`,
      OPENCLAW_TOKEN: TOKEN,
    },
  },
});
```

- [ ] **Step 3: Write the smoke test**

`e2e/chat.spec.ts`:

```ts
import { test, expect } from "@playwright/test";
import { startFakeGateway } from "./fixtures/gateway";

const PORT = 39789;
const TOKEN = "test-token";

test("send a message, see streamed response with tool call", async ({ page }) => {
  const stop = await startFakeGateway(PORT, TOKEN);
  try {
    await page.goto("/");
    await expect(page.getByRole("textbox")).toBeEnabled({ timeout: 15_000 });
    await page.getByRole("textbox").fill("hi");
    await page.getByRole("button", { name: /send/i }).click();
    await expect(page.getByText(/hello/)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/world/)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("search")).toBeVisible();
  } finally {
    await stop();
  }
});
```

- [ ] **Step 4: Run e2e**

```bash
pnpm test:e2e
```

Expected: 1 passing.

- [ ] **Step 5: Commit**

```bash
git add e2e/ playwright.config.ts
git commit -m "test(e2e): playwright smoke against fake gateway"
```

---

## Task 19: Final pass — typecheck, lint, full test suite, README pointer

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Run all checks**

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm build
```

Expected: all pass.

- [ ] **Step 2: Append to `README.md`**

```markdown
# clawapp

A chat-first webapp for [openclaw](https://github.com/openclaw/openclaw) with rich markdown, code, math, image, and agent-trace rendering.

## Run

```bash
pnpm install
pnpm dev
```

Reads gateway config from `~/.openclaw/openclaw.json`. Override with `OPENCLAW_GATEWAY_URL` and `OPENCLAW_TOKEN` env vars.

See [docs/superpowers/specs/2026-05-08-openclaw-webapp-chat-design.md](docs/superpowers/specs/2026-05-08-openclaw-webapp-chat-design.md) for the v1 design.
```

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: README quickstart"
```

---

## Notes on assumptions to validate during integration

- Gateway HTTP routes assumed: `GET /health`, `GET /sessions`, `GET /sessions/{id}/history`. WS route assumed `/chat` accepting `{sessionId, text}` JSON and emitting JSON events typed by `type`. If actual openclaw paths differ, update **only** `lib/openclaw/client.ts` (Tasks 5–6); the rest of the app is decoupled by `Client` and `StreamEvent`.
- If openclaw emits tool/thinking content as opaque tagged text rather than discrete events, add a parser in `lib/openclaw/client.ts` that splits the stream before yielding — public types stay the same.
- If the token in `~/.openclaw/openclaw.json` rotates, restart the dev server (config is cached at boot via `getClient`).
