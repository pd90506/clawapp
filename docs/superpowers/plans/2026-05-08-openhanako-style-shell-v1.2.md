# clawapp v1.2 (openhanako-style shell) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the clawapp UI shell to match openhanako's three-column cream-warm aesthetic: top tabs, grouped session sidebar with new-chat support, restyled chat, togglable right drawer with stub Desk/Note panels.

**Architecture:** Mostly frontend changes (components, hooks, theme tokens). Two new server routes (`GET /api/agents`, `POST /api/sessions`) and one modified route (`POST /api/chat` adds auto-label). The gateway client gets `listAgents`, `createSession`, `patchSessionLabel` methods. The existing `useChat` and SSE pipeline are unchanged.

**Tech Stack:** Same as v1.1 — Next.js 16, React 19, TypeScript, Tailwind 4 (CSS variables), Vitest, Playwright. No new deps.

**Spec:** [docs/superpowers/specs/2026-05-08-openhanako-style-shell-v1.2-design.md](../specs/2026-05-08-openhanako-style-shell-v1.2-design.md)

**Branch:** `feat/v1.2-shell-overhaul` (already created off `main`).

---

## File map (locked at plan time)

```
clawapp/
├── app/
│   ├── globals.css                       (rewritten: cream tokens)
│   ├── layout.tsx                        (unchanged)
│   ├── page.tsx                          (renders <AppShell/>)
│   ├── ChatPage.tsx                      (deleted — superseded by AppShell)
│   └── api/
│       ├── agents/route.ts               (new)
│       ├── sessions/route.ts             (extended: POST handler)
│       ├── chat/route.ts                 (extended: auto-label after first send)
│       └── … (others unchanged)
├── components/
│   ├── shell/
│   │   ├── AppShell.tsx                  (new, the main layout)
│   │   ├── TopBar.tsx                    (new)
│   │   ├── LeftSidebar.tsx               (new)
│   │   ├── RightDrawer.tsx               (new)
│   │   ├── SidebarToggleOverlay.tsx      (new)
│   │   ├── EmptyHero.tsx                 (new)
│   │   ├── ChannelsComingSoon.tsx        (new)
│   │   └── ChatView.tsx                  (new — wraps MessageList + Composer + EmptyHero)
│   ├── sidebar/
│   │   ├── SessionCard.tsx               (new)
│   │   ├── SessionGroup.tsx              (new)
│   │   ├── SessionList.tsx               (new — fetches + groups)
│   │   ├── SidebarHeader.tsx             (new)
│   │   └── SidebarNavRows.tsx            (new)
│   ├── agent/
│   │   └── AgentPicker.tsx               (new)
│   ├── chat/
│   │   ├── Message.tsx                   (restyled)
│   │   ├── StreamingMessage.tsx          (restyled)
│   │   ├── MessageList.tsx               (small spacing tweak)
│   │   └── Composer.tsx                  (restyled with model display)
│   ├── connection/
│   │   └── StatusBanner.tsx              (small style tweak — sit inside AppShell)
│   ├── render/                           (unchanged)
│   └── agent-trace/                      (unchanged)
├── hooks/
│   ├── useChat.ts                        (unchanged)
│   ├── useGatewayHealth.ts               (unchanged)
│   ├── useSidebarState.ts                (new)
│   ├── useActiveTab.ts                   (new)
│   ├── usePinnedSessions.ts              (new)
│   ├── useRelativeTime.ts                (new)
│   └── sseParse.ts                       (unchanged)
└── lib/
    ├── theme.ts                          (new — token map exports for TS use)
    ├── agentVisuals.ts                   (new — agentId → color/initial)
    └── openclaw/
        ├── client.ts                     (extended: listAgents, createSession, patchSessionLabel)
        └── … (others unchanged)
```

---

## Task 1: Cream-warm theme tokens

**Files:**
- Modify: `app/globals.css`
- Create: `lib/theme.ts`

- [ ] **Step 1: Read current `app/globals.css`** to confirm what's there. Replace its entire content with:

```css
@import "tailwindcss";

:root {
  --bg-base: #f6f1e7;
  --bg-card: #fbf7ee;
  --bg-elevated: #ffffff;
  --bg-hover: rgba(60, 40, 20, 0.04);
  --bg-active: rgba(60, 40, 20, 0.08);
  --border-soft: rgba(60, 40, 20, 0.08);
  --text-primary: #2c3142;
  --text-muted: #7a7568;
  --text-faint: #a39d8c;
  --accent: #4a6b8a;
  --accent-soft: #d8e2eb;
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg-base: #18181b;
    --bg-card: #1f1f23;
    --bg-elevated: #27272a;
    --bg-hover: rgba(255, 255, 255, 0.04);
    --bg-active: rgba(255, 255, 255, 0.08);
    --border-soft: rgba(255, 255, 255, 0.06);
    --text-primary: #e4e4e7;
    --text-muted: #a1a1aa;
    --text-faint: #71717a;
    --accent: #7aa3c8;
    --accent-soft: rgba(122, 163, 200, 0.18);
  }
}

html, body { height: 100%; }
body {
  background: var(--bg-base);
  color: var(--text-primary);
  font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
  -webkit-font-smoothing: antialiased;
}
```

- [ ] **Step 2: Create `lib/theme.ts`**

```ts
// CSS variable token names for TS-side reference. Values live in app/globals.css.
export const tokens = {
  bgBase: "var(--bg-base)",
  bgCard: "var(--bg-card)",
  bgElevated: "var(--bg-elevated)",
  bgHover: "var(--bg-hover)",
  bgActive: "var(--bg-active)",
  borderSoft: "var(--border-soft)",
  textPrimary: "var(--text-primary)",
  textMuted: "var(--text-muted)",
  textFaint: "var(--text-faint)",
  accent: "var(--accent)",
  accentSoft: "var(--accent-soft)",
} as const;
```

- [ ] **Step 3: Run** `pnpm build`. Expected: clean build, page renders cream-warm background.

- [ ] **Step 4: Commit**

```bash
git add app/globals.css lib/theme.ts
git commit -m "feat(theme): cream-warm token system + dark variant"
```

---

## Task 2: `lib/agentVisuals.ts` — deterministic color/initial per agent

**Files:**
- Create: `lib/agentVisuals.ts`, `lib/__tests__/agentVisuals.test.ts`

- [ ] **Step 1: Write failing test** at `lib/__tests__/agentVisuals.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { agentVisual } from "../agentVisuals";

describe("agentVisual", () => {
  it("returns a color and initial for an id", () => {
    const v = agentVisual("main");
    expect(v.color).toMatch(/^#[0-9a-f]{6}$/i);
    expect(v.initial).toBe("M");
  });
  it("returns the same color for the same id (deterministic)", () => {
    expect(agentVisual("foo").color).toBe(agentVisual("foo").color);
  });
  it("returns different colors for different ids (most pairs)", () => {
    const ids = ["main", "alpha", "beta", "gamma", "delta"];
    const colors = new Set(ids.map((id) => agentVisual(id).color));
    expect(colors.size).toBeGreaterThan(1);
  });
  it("uppercases first letter for initial", () => {
    expect(agentVisual("zen").initial).toBe("Z");
  });
});
```

- [ ] **Step 2: Run, expect FAIL**

```bash
pnpm test lib/__tests__/agentVisuals.test.ts
```

- [ ] **Step 3: Implement `lib/agentVisuals.ts`**

```ts
const PALETTE = [
  "#4a6b8a", "#7a8a4a", "#8a4a6b", "#6b4a8a",
  "#8a6b4a", "#4a8a8a", "#8a4a4a", "#4a8a4a",
];

function hash(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h) + s.charCodeAt(i);
  return Math.abs(h);
}

export function agentVisual(agentId: string): { color: string; initial: string } {
  const color = PALETTE[hash(agentId) % PALETTE.length];
  const initial = (agentId[0] ?? "?").toUpperCase();
  return { color, initial };
}
```

- [ ] **Step 4: Run, expect 4 PASS**

- [ ] **Step 5: Commit**

```bash
git add lib/agentVisuals.ts lib/__tests__/agentVisuals.test.ts
git commit -m "feat(agent): deterministic visual (color, initial) per agent id"
```

---

## Task 3: `Client.listAgents()` and `Client.createSession()`

**Files:**
- Modify: `lib/openclaw/client.ts`
- Modify: `lib/openclaw/__tests__/client.test.ts`

- [ ] **Step 1: Add failing tests** to `lib/openclaw/__tests__/client.test.ts`. After the existing tests, append:

```ts
describe("createClient — listAgents and createSession", () => {
  it("listAgents returns an array mapped to id/label", async () => {
    gw.onClient((c) => {
      c.onRequest(async (method) => {
        if (method === "agents.list") return { ok: true, payload: { agents: [
          { id: "main", displayName: "Main", model: "kimi/kimi-code" },
          { id: "test", label: "Test agent" },
        ]}};
        return { ok: false, error: { message: "no" } };
      });
    });
    const conn = GatewayConnection.fromConfig({ url: gw.httpUrl, token: "t", source: "file" });
    await conn.ready();
    const c = createClient(conn);
    const out = await c.listAgents();
    expect(out).toEqual([
      { id: "main", label: "Main", model: "kimi/kimi-code" },
      { id: "test", label: "Test agent" },
    ]);
    await conn.close();
  });

  it("createSession invokes sessions.create with namespaced key and returns SessionSummary", async () => {
    let createCallParams: unknown = null;
    gw.onClient((c) => {
      c.onRequest(async (method, params) => {
        if (method === "sessions.create") {
          createCallParams = params;
          const key = (params as { key: string }).key;
          return { ok: true, payload: { key, displayName: "New chat", hasActiveRun: false } };
        }
        return { ok: false, error: { message: "no" } };
      });
    });
    const conn = GatewayConnection.fromConfig({ url: gw.httpUrl, token: "t", source: "file" });
    await conn.ready();
    const c = createClient(conn);
    const r = await c.createSession({ label: "New chat" });
    expect(r.id).toMatch(/^web:/);
    expect(r.title).toBe("New chat");
    expect((createCallParams as { agentId: string; label: string }).agentId).toBe("main");
    expect((createCallParams as { label: string }).label).toBe("New chat");
    await conn.close();
  });

  it("patchSessionLabel invokes sessions.patch", async () => {
    let patchParams: unknown = null;
    gw.onClient((c) => {
      c.onRequest(async (method, params) => {
        if (method === "sessions.patch") {
          patchParams = params;
          return { ok: true, payload: { ok: true } };
        }
        return { ok: false, error: { message: "no" } };
      });
    });
    const conn = GatewayConnection.fromConfig({ url: gw.httpUrl, token: "t", source: "file" });
    await conn.ready();
    const c = createClient(conn);
    await c.patchSessionLabel("web:abc", "Renamed");
    expect((patchParams as { key: string; label: string }).key).toBe("web:abc");
    expect((patchParams as { label: string }).label).toBe("Renamed");
    await conn.close();
  });
});
```

- [ ] **Step 2: Run, expect FAIL**

```bash
pnpm test lib/openclaw/__tests__/client.test.ts
```

- [ ] **Step 3: Modify `lib/openclaw/client.ts`** — add the three new methods. Update the `Client` type and the `createClient` factory.

In the `Client` type, add three lines so it becomes:

```ts
export type Client = {
  listSessions(): Promise<SessionSummary[]>;
  getHistory(sessionId: string): Promise<Message[]>;
  health(): Promise<{ ok: boolean; reason?: string }>;
  sendMessage(sessionId: string, text: string, signal?: AbortSignal): AsyncIterable<StreamEvent>;
  listAgents(): Promise<AgentSummary[]>;
  createSession(opts?: { label?: string; agentId?: string }): Promise<SessionSummary>;
  patchSessionLabel(sessionId: string, label: string): Promise<void>;
};

export type AgentSummary = { id: string; label: string; model?: string };
```

Add to the imports at the top: `import { randomUUID } from "node:crypto";` (if not already there).

In `createClient(conn)`, add:

```ts
async function listAgents(): Promise<AgentSummary[]> {
  const p = await conn.invoke("agents.list", {}) as { agents?: { id?: string; label?: string; displayName?: string; name?: string; model?: string }[] };
  return (p?.agents ?? []).map((a) => ({
    id: a.id ?? "",
    label: a.label ?? a.displayName ?? a.name ?? a.id ?? "",
    model: a.model,
  }));
}

async function createSession(opts?: { label?: string; agentId?: string }): Promise<SessionSummary> {
  const key = `web:${randomUUID()}`;
  const p = await conn.invoke("sessions.create", {
    key,
    agentId: opts?.agentId ?? "main",
    label: opts?.label ?? "New chat",
  }) as { key?: string; displayName?: string; derivedTitle?: string; label?: string };
  return {
    id: p.key ?? key,
    title: p.displayName ?? p.derivedTitle ?? p.label ?? "New chat",
  };
}

async function patchSessionLabel(sessionId: string, label: string): Promise<void> {
  await conn.invoke("sessions.patch", { key: sessionId, label });
}
```

Return them from `createClient`:

```ts
return { listSessions, getHistory, health, sendMessage, listAgents, createSession, patchSessionLabel };
```

- [ ] **Step 4: Run, expect 3 new tests PASS** + all prior tests still pass.

- [ ] **Step 5: Commit**

```bash
git add lib/openclaw/client.ts lib/openclaw/__tests__/client.test.ts
git commit -m "feat(openclaw): listAgents, createSession (web: prefix), patchSessionLabel"
```

---

## Task 4: `GET /api/agents` route

**Files:**
- Create: `app/api/agents/route.ts`, `app/api/agents/route.test.ts`

- [ ] **Step 1: Write failing test** at `app/api/agents/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/openclaw", () => ({ getClient: vi.fn() }));
import { getClient } from "@/lib/openclaw";
import { GET } from "./route";

beforeEach(() => vi.mocked(getClient).mockReset());

describe("GET /api/agents", () => {
  it("returns 503 when no client", async () => {
    vi.mocked(getClient).mockReturnValue(null);
    const r = await GET();
    expect(r.status).toBe(503);
  });
  it("returns agents array on success", async () => {
    vi.mocked(getClient).mockReturnValue({
      listAgents: async () => [{ id: "main", label: "Main", model: "kimi/kimi-code" }],
    } as never);
    const r = await GET();
    expect(await r.json()).toEqual({ agents: [{ id: "main", label: "Main", model: "kimi/kimi-code" }] });
  });
});
```

- [ ] **Step 2: Run, expect FAIL**

- [ ] **Step 3: Implement** `app/api/agents/route.ts`:

```ts
import { NextResponse } from "next/server";
import { getClient } from "@/lib/openclaw";

export async function GET() {
  const c = getClient();
  if (!c) return NextResponse.json({ error: "no-config" }, { status: 503 });
  const agents = await c.listAgents();
  return NextResponse.json({ agents });
}
```

- [ ] **Step 4: Run, expect 2 PASS**

- [ ] **Step 5: Commit**

```bash
git add app/api/agents/
git commit -m "feat(api): GET /api/agents proxies agents.list"
```

---

## Task 5: `POST /api/sessions` route + auto-label in chat route

**Files:**
- Modify: `app/api/sessions/route.ts` (add POST handler)
- Modify: `app/api/sessions/route.test.ts` (extend)
- Modify: `app/api/chat/route.ts` (auto-label after first send)
- Modify: `app/api/chat/route.test.ts` (extend)

- [ ] **Step 1: Add failing test** to `app/api/sessions/route.test.ts`. Append:

```ts
import { POST as listPOST } from "./route";

describe("POST /api/sessions", () => {
  it("returns 503 when no client", async () => {
    vi.mocked(getClient).mockReturnValue(null);
    const r = await listPOST(new Request("http://x", { method: "POST", body: "{}" }));
    expect(r.status).toBe(503);
  });
  it("creates a session with given label", async () => {
    const createSession = vi.fn(async () => ({ id: "web:abc", title: "Hello" }));
    vi.mocked(getClient).mockReturnValue({ createSession } as never);
    const r = await listPOST(new Request("http://x", { method: "POST", body: JSON.stringify({ label: "Hello" }) }));
    expect(await r.json()).toEqual({ id: "web:abc", title: "Hello" });
    expect(createSession).toHaveBeenCalledWith({ label: "Hello" });
  });
  it("creates with default label when body empty", async () => {
    const createSession = vi.fn(async () => ({ id: "web:abc", title: "New chat" }));
    vi.mocked(getClient).mockReturnValue({ createSession } as never);
    const r = await listPOST(new Request("http://x", { method: "POST", body: "{}" }));
    expect(r.status).toBe(200);
    expect(createSession).toHaveBeenCalledWith({ label: undefined });
  });
});
```

- [ ] **Step 2: Run, expect FAIL**

- [ ] **Step 3: Add POST handler to `app/api/sessions/route.ts`** (keep existing GET):

```ts
import { z } from "zod";
// keep existing imports

const PostBody = z.object({ label: z.string().optional() });

export async function POST(req: Request) {
  const c = getClient();
  if (!c) return NextResponse.json({ error: "no-config" }, { status: 503 });
  const body = await req.json().catch(() => ({}));
  const parsed = PostBody.safeParse(body);
  const label = parsed.success ? parsed.data.label : undefined;
  const summary = await c.createSession({ label });
  return NextResponse.json(summary);
}
```

- [ ] **Step 4: Run sessions tests, expect new tests PASS** + prior tests still pass.

- [ ] **Step 5: Add failing test** for auto-label in `app/api/chat/route.test.ts`. Append:

```ts
it("triggers patchSessionLabel after first send when label is 'New chat'", async () => {
  const patchSessionLabel = vi.fn(async () => undefined);
  vi.mocked(getClient).mockReturnValue({
    listSessions: async () => [{ id: "web:abc", title: "New chat" }],
    async *sendMessage() { yield { type: "done" } as const; },
    patchSessionLabel,
  } as never);
  const r = await POST(new Request("http://x", {
    method: "POST",
    body: JSON.stringify({ sessionId: "web:abc", text: "Hello world" }),
  }));
  // Drain SSE
  const reader = r.body!.getReader(); while (!(await reader.read()).done) { /* drain */ }
  // Give the fire-and-forget patch a tick
  await new Promise((res) => setTimeout(res, 30));
  expect(patchSessionLabel).toHaveBeenCalledWith("web:abc", "Hello world");
});

it("does NOT patch when current title is not 'New chat'", async () => {
  const patchSessionLabel = vi.fn(async () => undefined);
  vi.mocked(getClient).mockReturnValue({
    listSessions: async () => [{ id: "web:abc", title: "Already named" }],
    async *sendMessage() { yield { type: "done" } as const; },
    patchSessionLabel,
  } as never);
  const r = await POST(new Request("http://x", {
    method: "POST",
    body: JSON.stringify({ sessionId: "web:abc", text: "Hello" }),
  }));
  const reader = r.body!.getReader(); while (!(await reader.read()).done) { /* drain */ }
  await new Promise((res) => setTimeout(res, 30));
  expect(patchSessionLabel).not.toHaveBeenCalled();
});
```

- [ ] **Step 6: Modify `app/api/chat/route.ts`** to fire the auto-label after `chat.send` succeeds. Insert this logic right after the `Body.safeParse` check (`if (!parsed.success) return ...`):

```ts
// Fire-and-forget auto-label for "New chat" sessions
const TITLE_PLACEHOLDER = "New chat";
const LABEL_MAX_CHARS = 40;
(async () => {
  try {
    const sessions = await c.listSessions();
    const found = sessions.find((s) => s.id === parsed.data.sessionId);
    if (found?.title === TITLE_PLACEHOLDER) {
      const newLabel = parsed.data.text.slice(0, LABEL_MAX_CHARS);
      await c.patchSessionLabel(parsed.data.sessionId, newLabel);
    }
  } catch { /* non-fatal */ }
})();
```

- [ ] **Step 7: Run, expect both new tests PASS** + prior chat tests still pass.

- [ ] **Step 8: Commit**

```bash
git add app/api/sessions/ app/api/chat/
git commit -m "feat(api): POST /api/sessions + auto-label first message in chat route"
```

---

## Task 6: Hook — `useSidebarState`

**Files:**
- Create: `hooks/useSidebarState.ts`, `hooks/useSidebarState.test.tsx`

- [ ] **Step 1: Write failing test** at `hooks/useSidebarState.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSidebarState } from "./useSidebarState";

beforeEach(() => { localStorage.clear(); });

describe("useSidebarState", () => {
  it("defaults to both open", () => {
    const { result } = renderHook(() => useSidebarState());
    expect(result.current.left).toBe(true);
    expect(result.current.right).toBe(true);
  });
  it("toggle persists to localStorage", () => {
    const { result } = renderHook(() => useSidebarState());
    act(() => { result.current.setLeft(false); });
    expect(JSON.parse(localStorage.getItem("clawapp.sidebars") ?? "{}").left).toBe(false);
  });
  it("rehydrates from localStorage", () => {
    localStorage.setItem("clawapp.sidebars", JSON.stringify({ left: false, right: true }));
    const { result } = renderHook(() => useSidebarState());
    expect(result.current.left).toBe(false);
    expect(result.current.right).toBe(true);
  });
});
```

- [ ] **Step 2: Run, expect FAIL**

- [ ] **Step 3: Implement `hooks/useSidebarState.ts`**

```ts
"use client";
import { useEffect, useState } from "react";

const KEY = "clawapp.sidebars";
type State = { left: boolean; right: boolean };

function load(): State {
  if (typeof window === "undefined") return { left: true, right: true };
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return { left: true, right: true };
    const parsed = JSON.parse(raw);
    return {
      left: typeof parsed.left === "boolean" ? parsed.left : true,
      right: typeof parsed.right === "boolean" ? parsed.right : true,
    };
  } catch {
    return { left: true, right: true };
  }
}

export function useSidebarState() {
  const [state, setState] = useState<State>(() => load());

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(KEY, JSON.stringify(state));
    }
  }, [state]);

  return {
    left: state.left,
    right: state.right,
    setLeft: (v: boolean) => setState((s) => ({ ...s, left: v })),
    setRight: (v: boolean) => setState((s) => ({ ...s, right: v })),
    toggleLeft: () => setState((s) => ({ ...s, left: !s.left })),
    toggleRight: () => setState((s) => ({ ...s, right: !s.right })),
  };
}
```

- [ ] **Step 4: Run, expect 3 PASS**

- [ ] **Step 5: Commit**

```bash
git add hooks/useSidebarState.ts hooks/useSidebarState.test.tsx
git commit -m "feat(hooks): useSidebarState with localStorage persistence"
```

---

## Task 7: Hooks — `useActiveTab` and `usePinnedSessions`

**Files:**
- Create: `hooks/useActiveTab.ts`, `hooks/useActiveTab.test.tsx`
- Create: `hooks/usePinnedSessions.ts`, `hooks/usePinnedSessions.test.tsx`

- [ ] **Step 1: Test for useActiveTab** at `hooks/useActiveTab.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useActiveTab } from "./useActiveTab";

beforeEach(() => {
  // jsdom default URL is http://localhost/
  window.history.replaceState(null, "", "/");
});

describe("useActiveTab", () => {
  it("defaults to chat when no query", () => {
    const { result } = renderHook(() => useActiveTab());
    expect(result.current.tab).toBe("chat");
  });
  it("reads channels when ?tab=channels", () => {
    window.history.replaceState(null, "", "/?tab=channels");
    const { result } = renderHook(() => useActiveTab());
    expect(result.current.tab).toBe("channels");
  });
});
```

- [ ] **Step 2: Test for usePinnedSessions** at `hooks/usePinnedSessions.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { usePinnedSessions } from "./usePinnedSessions";

beforeEach(() => { localStorage.clear(); });

describe("usePinnedSessions", () => {
  it("starts empty", () => {
    const { result } = renderHook(() => usePinnedSessions());
    expect(result.current.isPinned("any")).toBe(false);
  });
  it("toggles pinned state and persists", () => {
    const { result } = renderHook(() => usePinnedSessions());
    act(() => { result.current.togglePin("s1"); });
    expect(result.current.isPinned("s1")).toBe(true);
    act(() => { result.current.togglePin("s1"); });
    expect(result.current.isPinned("s1")).toBe(false);
  });
  it("rehydrates from localStorage", () => {
    localStorage.setItem("clawapp.pinned", JSON.stringify(["s1", "s2"]));
    const { result } = renderHook(() => usePinnedSessions());
    expect(result.current.isPinned("s1")).toBe(true);
    expect(result.current.isPinned("s2")).toBe(true);
    expect(result.current.isPinned("s3")).toBe(false);
  });
});
```

- [ ] **Step 3: Run both tests, expect FAIL**

- [ ] **Step 4: Implement `hooks/useActiveTab.ts`**

```ts
"use client";
import { useEffect, useState } from "react";

export type Tab = "chat" | "channels";

function read(): Tab {
  if (typeof window === "undefined") return "chat";
  const t = new URLSearchParams(window.location.search).get("tab");
  return t === "channels" ? "channels" : "chat";
}

export function useActiveTab() {
  const [tab, setTab] = useState<Tab>(() => read());

  useEffect(() => {
    const onPop = () => setTab(read());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const setTabUrl = (next: Tab) => {
    setTab(next);
    const url = new URL(window.location.href);
    if (next === "chat") url.searchParams.delete("tab");
    else url.searchParams.set("tab", next);
    window.history.replaceState(null, "", url);
  };

  return { tab, setTab: setTabUrl };
}
```

- [ ] **Step 5: Implement `hooks/usePinnedSessions.ts`**

```ts
"use client";
import { useCallback, useEffect, useState } from "react";

const KEY = "clawapp.pinned";

function load(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch { return new Set(); }
}

export function usePinnedSessions() {
  const [pinned, setPinned] = useState<Set<string>>(() => load());

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(KEY, JSON.stringify([...pinned]));
    }
  }, [pinned]);

  const isPinned = useCallback((id: string) => pinned.has(id), [pinned]);
  const togglePin = useCallback((id: string) => {
    setPinned((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }, []);

  return { isPinned, togglePin };
}
```

- [ ] **Step 6: Run, expect 5 total PASS** across both files

- [ ] **Step 7: Commit**

```bash
git add hooks/useActiveTab.ts hooks/useActiveTab.test.tsx hooks/usePinnedSessions.ts hooks/usePinnedSessions.test.tsx
git commit -m "feat(hooks): useActiveTab + usePinnedSessions"
```

---

## Task 8: Hook — `useRelativeTime`

**Files:**
- Create: `hooks/useRelativeTime.ts`, `hooks/useRelativeTime.test.ts`

- [ ] **Step 1: Test** at `hooks/useRelativeTime.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { formatRelativeTime } from "./useRelativeTime";

const NOW = new Date("2026-05-08T12:00:00Z").getTime();

describe("formatRelativeTime", () => {
  it("returns 'now' under a minute", () => {
    expect(formatRelativeTime(NOW - 5000, NOW)).toBe("now");
  });
  it("returns minutes under an hour", () => {
    expect(formatRelativeTime(NOW - 5 * 60_000, NOW)).toBe("5m");
  });
  it("returns hours under a day (same calendar day)", () => {
    expect(formatRelativeTime(NOW - 3 * 3_600_000, NOW)).toBe("3h");
  });
  it("returns 'yesterday' for previous day", () => {
    expect(formatRelativeTime(NOW - 26 * 3_600_000, NOW)).toBe("yesterday");
  });
  it("returns 'Nd' for older within a week", () => {
    expect(formatRelativeTime(NOW - 4 * 24 * 3_600_000, NOW)).toBe("4d");
  });
  it("returns absolute date for older than a week", () => {
    const out = formatRelativeTime(NOW - 30 * 24 * 3_600_000, NOW);
    expect(out).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
```

- [ ] **Step 2: Run, expect FAIL**

- [ ] **Step 3: Implement `hooks/useRelativeTime.ts`**

```ts
export function formatRelativeTime(at: number, now: number = Date.now()): string {
  const diffMs = now - at;
  if (diffMs < 60_000) return "now";
  if (diffMs < 3_600_000) return `${Math.floor(diffMs / 60_000)}m`;
  const sameDay = new Date(at).toDateString() === new Date(now).toDateString();
  if (sameDay) return `${Math.floor(diffMs / 3_600_000)}h`;
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (new Date(at).toDateString() === yesterday.toDateString()) return "yesterday";
  const days = Math.floor(diffMs / (24 * 3_600_000));
  if (days < 7) return `${days}d`;
  // Absolute date YYYY-MM-DD
  const d = new Date(at);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
```

- [ ] **Step 4: Run, expect 6 PASS**

- [ ] **Step 5: Commit**

```bash
git add hooks/useRelativeTime.ts hooks/useRelativeTime.test.ts
git commit -m "feat(hooks): formatRelativeTime helper"
```

---

## Task 9: `AgentPicker` component

**Files:**
- Create: `components/agent/AgentPicker.tsx`, `components/agent/AgentPicker.test.tsx`

- [ ] **Step 1: Test** at `components/agent/AgentPicker.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AgentPicker } from "./AgentPicker";

beforeEach(() => { vi.unstubAllGlobals(); });

describe("AgentPicker", () => {
  it("renders chips fetched from /api/agents", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ agents: [{ id: "main", label: "Main" }, { id: "alpha", label: "Alpha" }] }), { status: 200 }),
    ));
    render(<AgentPicker selected="main" onSelect={() => {}} />);
    await waitFor(() => {
      expect(screen.getByText("Main")).toBeInTheDocument();
      expect(screen.getByText("Alpha")).toBeInTheDocument();
    });
  });

  it("clicking a chip fires onSelect", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ agents: [{ id: "main", label: "Main" }, { id: "alpha", label: "Alpha" }] }), { status: 200 }),
    ));
    const onSelect = vi.fn();
    render(<AgentPicker selected="main" onSelect={onSelect} />);
    await waitFor(() => screen.getByText("Alpha"));
    await userEvent.click(screen.getByText("Alpha"));
    expect(onSelect).toHaveBeenCalledWith("alpha");
  });

  it("falls back to a Default chip on fetch error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("boom")));
    render(<AgentPicker selected="main" onSelect={() => {}} />);
    await waitFor(() => {
      expect(screen.getByText("Default")).toBeInTheDocument();
    });
  });
});
```

- [ ] **Step 2: Run, expect FAIL**

- [ ] **Step 3: Implement `components/agent/AgentPicker.tsx`**

```tsx
"use client";
import { useEffect, useState } from "react";
import { agentVisual } from "@/lib/agentVisuals";

type Agent = { id: string; label: string };

type Props = { selected: string; onSelect: (id: string) => void };

export function AgentPicker({ selected, onSelect }: Props) {
  const [agents, setAgents] = useState<Agent[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/agents")
      .then((r) => r.json())
      .then((j) => { if (!cancelled) setAgents(j.agents ?? []); })
      .catch(() => { if (!cancelled) setAgents([{ id: "main", label: "Default" }]); });
    return () => { cancelled = true; };
  }, []);

  if (!agents) return <div className="h-10" />;
  if (agents.length === 0) return null;

  return (
    <div className="flex gap-2 flex-wrap justify-center">
      {agents.map((a) => {
        const v = agentVisual(a.id);
        const active = a.id === selected;
        return (
          <button
            key={a.id}
            type="button"
            onClick={() => onSelect(a.id)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm transition-colors ${
              active
                ? "bg-[var(--accent-soft)] border-[var(--accent)] text-[var(--accent)]"
                : "bg-[var(--bg-card)] border-[var(--border-soft)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
            }`}
          >
            <span
              aria-hidden
              className="inline-block w-5 h-5 rounded-full text-[10px] text-white grid place-items-center"
              style={{ background: v.color }}
            >
              {v.initial}
            </span>
            {a.label}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Run, expect 3 PASS**

- [ ] **Step 5: Commit**

```bash
git add components/agent/
git commit -m "feat(agent): AgentPicker chip group fed from /api/agents"
```

---

## Task 10: `EmptyHero` and `ChannelsComingSoon`

**Files:**
- Create: `components/shell/EmptyHero.tsx`, `components/shell/EmptyHero.test.tsx`
- Create: `components/shell/ChannelsComingSoon.tsx`

- [ ] **Step 1: Test** at `components/shell/EmptyHero.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { EmptyHero } from "./EmptyHero";

describe("EmptyHero", () => {
  it("renders the prompt and an agent picker", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ agents: [{ id: "main", label: "Main" }] }), { status: 200 }),
    ));
    render(<EmptyHero selectedAgent="main" onSelectAgent={() => {}} />);
    expect(screen.getByText(/What are we chatting about/i)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("Main")).toBeInTheDocument());
  });
});
```

- [ ] **Step 2: Implement `components/shell/EmptyHero.tsx`**

```tsx
"use client";
import { AgentPicker } from "@/components/agent/AgentPicker";

type Props = { selectedAgent: string; onSelectAgent: (id: string) => void };

export function EmptyHero({ selectedAgent, onSelectAgent }: Props) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
      <div
        aria-hidden
        className="w-32 h-32 rounded-full bg-[var(--bg-card)] border border-[var(--border-soft)] mb-6 grid place-items-center"
      >
        <span className="text-5xl text-[var(--accent)]">◐</span>
      </div>
      <h1 className="text-xl font-medium text-[var(--text-primary)] mb-6">
        What are we chatting about today?
      </h1>
      <AgentPicker selected={selectedAgent} onSelect={onSelectAgent} />
    </div>
  );
}
```

- [ ] **Step 3: Implement `components/shell/ChannelsComingSoon.tsx`** (no separate test — trivial)

```tsx
"use client";

export function ChannelsComingSoon() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
      <div className="max-w-md p-6 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-soft)]">
        <h2 className="text-lg font-medium mb-2">Channels are coming</h2>
        <p className="text-sm text-[var(--text-muted)]">
          Connect Telegram, Slack, and other inboxes here. v1.3.
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run, expect 1 PASS**

- [ ] **Step 5: Commit**

```bash
git add components/shell/EmptyHero.tsx components/shell/EmptyHero.test.tsx components/shell/ChannelsComingSoon.tsx
git commit -m "feat(shell): EmptyHero + ChannelsComingSoon placeholders"
```

---

## Task 11: `SessionCard` component

**Files:**
- Create: `components/sidebar/SessionCard.tsx`, `components/sidebar/SessionCard.test.tsx`

- [ ] **Step 1: Test**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SessionCard } from "./SessionCard";

describe("SessionCard", () => {
  const session = { id: "web:abc", title: "New chat", agentId: "main", model: "kimi/kimi-code", at: Date.now() - 5_000 };

  it("renders title, subtitle and avatar initial", () => {
    render(<SessionCard session={session} active={false} pinned={false} onSelect={() => {}} onTogglePin={() => {}} />);
    expect(screen.getByText("New chat")).toBeInTheDocument();
    expect(screen.getByText(/main · kimi\/kimi-code · now/)).toBeInTheDocument();
    expect(screen.getByText("M")).toBeInTheDocument();
  });

  it("shows active state with bullet", () => {
    const { container } = render(<SessionCard session={session} active={true} pinned={false} onSelect={() => {}} onTogglePin={() => {}} />);
    expect(container.querySelector('[aria-label="active session"]')).not.toBeNull();
  });

  it("calls onSelect when clicked", async () => {
    const onSelect = vi.fn();
    render(<SessionCard session={session} active={false} pinned={false} onSelect={onSelect} onTogglePin={() => {}} />);
    await userEvent.click(screen.getByText("New chat"));
    expect(onSelect).toHaveBeenCalledWith("web:abc");
  });
});
```

- [ ] **Step 2: Implement `components/sidebar/SessionCard.tsx`**

```tsx
"use client";
import { agentVisual } from "@/lib/agentVisuals";
import { formatRelativeTime } from "@/hooks/useRelativeTime";

export type SessionView = {
  id: string;
  title: string;
  agentId: string;
  model?: string;
  at: number;
};

type Props = {
  session: SessionView;
  active: boolean;
  pinned: boolean;
  onSelect: (id: string) => void;
  onTogglePin: (id: string) => void;
};

export function SessionCard({ session, active, pinned, onSelect, onTogglePin }: Props) {
  const v = agentVisual(session.agentId);
  return (
    <div
      onContextMenu={(e) => { e.preventDefault(); onTogglePin(session.id); }}
      onClick={() => onSelect(session.id)}
      className={`flex items-start gap-3 px-3 py-2 rounded-xl cursor-pointer transition-colors ${
        active ? "bg-[var(--bg-active)]" : "hover:bg-[var(--bg-hover)]"
      }`}
    >
      <span
        aria-hidden
        className="shrink-0 w-8 h-8 rounded-full grid place-items-center text-xs text-white font-medium"
        style={{ background: v.color }}
      >
        {v.initial}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1">
          {active && <span aria-label="active session" className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]" />}
          <span className="truncate text-sm text-[var(--text-primary)]">{session.title}</span>
          {pinned && <span aria-label="pinned" className="text-xs text-[var(--text-faint)]">📌</span>}
        </div>
        <div className="text-xs text-[var(--text-muted)] truncate">
          {session.agentId}{session.model ? ` · ${session.model}` : ""} · {formatRelativeTime(session.at)}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Run, expect 3 PASS**

- [ ] **Step 4: Commit**

```bash
git add components/sidebar/SessionCard.tsx components/sidebar/SessionCard.test.tsx
git commit -m "feat(sidebar): SessionCard with avatar, title, subtitle, active/pinned states"
```

---

## Task 12: `SessionGroup` and `SessionList`

**Files:**
- Create: `components/sidebar/SessionGroup.tsx`
- Create: `components/sidebar/SessionList.tsx`, `components/sidebar/SessionList.test.tsx`

- [ ] **Step 1: Test** at `components/sidebar/SessionList.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { SessionList } from "./SessionList";

const NOW = new Date("2026-05-08T12:00:00Z").getTime();

describe("SessionList", () => {
  it("groups sessions by recency, with pinned first", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ sessions: [
        { id: "web:1", title: "Today A" },
        { id: "web:2", title: "Yesterday B" },
        { id: "web:3", title: "Pinned C" },
      ]}), { status: 200 }),
    ));
    // The component derives `at` & agentId for now from constants; real backend hooks land in Task 14.
    render(<SessionList activeSessionId={null} pinnedIds={new Set(["web:3"])} onSelect={() => {}} onTogglePin={() => {}} now={NOW} />);
    await waitFor(() => expect(screen.getByText("Pinned C")).toBeInTheDocument());
    expect(screen.getByText(/Pinned/i)).toBeInTheDocument();
    expect(screen.getByText("Today A")).toBeInTheDocument();
  });

  it("hides empty group sections", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ sessions: [{ id: "web:1", title: "Today A" }] }), { status: 200 }),
    ));
    render(<SessionList activeSessionId={null} pinnedIds={new Set()} onSelect={() => {}} onTogglePin={() => {}} now={NOW} />);
    await waitFor(() => expect(screen.getByText("Today A")).toBeInTheDocument());
    expect(screen.queryByText(/Pinned/i)).toBeNull();
  });
});
```

- [ ] **Step 2: Implement `components/sidebar/SessionGroup.tsx`** (no separate test):

```tsx
"use client";
import type { ReactNode } from "react";

export function SessionGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mt-3 first:mt-0">
      <div className="px-3 pb-1 text-xs uppercase tracking-wider text-[var(--text-faint)]">{title}</div>
      <div className="flex flex-col gap-0.5">{children}</div>
    </div>
  );
}
```

- [ ] **Step 3: Implement `components/sidebar/SessionList.tsx`**

```tsx
"use client";
import { useEffect, useState } from "react";
import { SessionCard, type SessionView } from "./SessionCard";
import { SessionGroup } from "./SessionGroup";

type Props = {
  activeSessionId: string | null;
  pinnedIds: Set<string>;
  onSelect: (id: string) => void;
  onTogglePin: (id: string) => void;
  now?: number;
};

type RawSession = { id: string; title: string; agentId?: string; model?: string; updatedAt?: number; at?: number };

const POLL_MS = 30_000;

export function SessionList({ activeSessionId, pinnedIds, onSelect, onTogglePin, now }: Props) {
  const [sessions, setSessions] = useState<SessionView[] | null>(null);
  const referenceNow = now ?? Date.now();

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const r = await fetch("/api/sessions");
        const j = await r.json();
        if (cancelled) return;
        setSessions((j.sessions as RawSession[]).map((s) => ({
          id: s.id,
          title: s.title || "(untitled)",
          agentId: s.agentId ?? extractAgentFromId(s.id),
          model: s.model,
          at: s.updatedAt ?? s.at ?? referenceNow,
        })));
      } catch {
        if (!cancelled) setSessions([]);
      }
    };
    load();
    const id = setInterval(load, POLL_MS);
    return () => { cancelled = true; clearInterval(id); };
  }, [referenceNow]);

  if (sessions === null) return <div className="px-3 py-2 text-xs text-[var(--text-faint)]">Loading…</div>;
  if (sessions.length === 0) return <div className="px-3 py-2 text-xs text-[var(--text-faint)]">No sessions yet</div>;

  const groups = bucket(sessions, pinnedIds, referenceNow);

  return (
    <div>
      {groups.map(([title, items]) => items.length > 0 && (
        <SessionGroup key={title} title={title}>
          {items.map((s) => (
            <SessionCard
              key={s.id}
              session={s}
              active={s.id === activeSessionId}
              pinned={pinnedIds.has(s.id)}
              onSelect={onSelect}
              onTogglePin={onTogglePin}
            />
          ))}
        </SessionGroup>
      ))}
    </div>
  );
}

function extractAgentFromId(id: string): string {
  // e.g. "agent:main:main" → "main"
  const m = id.match(/^agent:([^:]+)/);
  return m?.[1] ?? "main";
}

function bucket(sessions: SessionView[], pinned: Set<string>, now: number): [string, SessionView[]][] {
  const startToday = new Date(now); startToday.setHours(0, 0, 0, 0);
  const startYesterday = new Date(startToday.getTime() - 24 * 3600_000);
  const startWeek = new Date(startToday.getTime() - 6 * 24 * 3600_000);

  const pinnedItems: SessionView[] = [];
  const today: SessionView[] = [];
  const yesterday: SessionView[] = [];
  const thisWeek: SessionView[] = [];
  const older: SessionView[] = [];

  const sorted = [...sessions].sort((a, b) => b.at - a.at);
  for (const s of sorted) {
    if (pinned.has(s.id)) { pinnedItems.push(s); continue; }
    if (s.at >= startToday.getTime()) today.push(s);
    else if (s.at >= startYesterday.getTime()) yesterday.push(s);
    else if (s.at >= startWeek.getTime()) thisWeek.push(s);
    else older.push(s);
  }
  return [
    ["Pinned", pinnedItems],
    ["Today", today],
    ["Yesterday", yesterday],
    ["This week", thisWeek],
    ["Older", older],
  ];
}
```

- [ ] **Step 4: Run, expect 2 PASS**

- [ ] **Step 5: Commit**

```bash
git add components/sidebar/SessionGroup.tsx components/sidebar/SessionList.tsx components/sidebar/SessionList.test.tsx
git commit -m "feat(sidebar): SessionList with grouping and 30s poll"
```

---

## Task 13: `SidebarHeader` and `SidebarNavRows`

**Files:**
- Create: `components/sidebar/SidebarHeader.tsx`, `components/sidebar/SidebarHeader.test.tsx`
- Create: `components/sidebar/SidebarNavRows.tsx`

- [ ] **Step 1: Test** at `components/sidebar/SidebarHeader.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SidebarHeader } from "./SidebarHeader";

describe("SidebarHeader", () => {
  it("calls onNewChat when + clicked", async () => {
    const onNewChat = vi.fn();
    render(<SidebarHeader onNewChat={onNewChat} onCollapse={() => {}} disabled={false} />);
    await userEvent.click(screen.getByRole("button", { name: /new chat/i }));
    expect(onNewChat).toHaveBeenCalled();
  });
  it("disables new chat when disabled prop is true", () => {
    render(<SidebarHeader onNewChat={() => {}} onCollapse={() => {}} disabled={true} />);
    expect(screen.getByRole("button", { name: /new chat/i })).toBeDisabled();
  });
});
```

- [ ] **Step 2: Implement `components/sidebar/SidebarHeader.tsx`**

```tsx
"use client";

type Props = {
  onNewChat: () => void;
  onCollapse: () => void;
  disabled: boolean;
};

export function SidebarHeader({ onNewChat, onCollapse, disabled }: Props) {
  return (
    <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border-soft)]">
      <div className="font-medium text-sm">Chats</div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onNewChat}
          disabled={disabled}
          aria-label="New chat"
          className="w-7 h-7 rounded-lg hover:bg-[var(--bg-hover)] grid place-items-center disabled:opacity-50"
        >
          <span className="text-base">＋</span>
        </button>
        <button
          type="button"
          aria-label="Settings"
          disabled
          title="Coming in v1.3"
          className="w-7 h-7 rounded-lg grid place-items-center opacity-50 cursor-not-allowed"
        >
          <span className="text-sm">⚙</span>
        </button>
        <button
          type="button"
          onClick={onCollapse}
          aria-label="Collapse sidebar"
          className="w-7 h-7 rounded-lg hover:bg-[var(--bg-hover)] grid place-items-center"
        >
          <span className="text-sm">‹</span>
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Implement `components/sidebar/SidebarNavRows.tsx`** (no test — pure markup):

```tsx
"use client";

export function SidebarNavRows() {
  return (
    <div className="px-3 py-2 flex flex-col gap-0.5 border-b border-[var(--border-soft)]">
      <NavRow icon="🔗" label="Connect channels" />
      <NavRow icon="⚡" label="Activity" />
      <NavRow icon="⏱" label="Tasks" />
    </div>
  );
}

function NavRow({ icon, label }: { icon: string; label: string }) {
  return (
    <button
      type="button"
      disabled
      title="Coming in v1.3"
      className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm text-[var(--text-muted)] opacity-70 cursor-not-allowed"
    >
      <span className="w-5 text-center">{icon}</span>
      <span>{label}</span>
    </button>
  );
}
```

- [ ] **Step 4: Run sidebar tests, expect 2 PASS**

- [ ] **Step 5: Commit**

```bash
git add components/sidebar/SidebarHeader.tsx components/sidebar/SidebarHeader.test.tsx components/sidebar/SidebarNavRows.tsx
git commit -m "feat(sidebar): SidebarHeader (+/⚙/<) and SidebarNavRows placeholders"
```

---

## Task 14: `LeftSidebar` (assemble)

**Files:**
- Create: `components/shell/LeftSidebar.tsx`

- [ ] **Step 1: Implement `components/shell/LeftSidebar.tsx`** (no separate test — its parts have tests; visual-only assembly):

```tsx
"use client";
import { SidebarHeader } from "@/components/sidebar/SidebarHeader";
import { SidebarNavRows } from "@/components/sidebar/SidebarNavRows";
import { SessionList } from "@/components/sidebar/SessionList";

type Props = {
  activeSessionId: string | null;
  pinnedIds: Set<string>;
  onSelectSession: (id: string) => void;
  onTogglePin: (id: string) => void;
  onNewChat: () => void;
  onCollapse: () => void;
  newChatDisabled: boolean;
};

export function LeftSidebar({
  activeSessionId, pinnedIds, onSelectSession, onTogglePin, onNewChat, onCollapse, newChatDisabled,
}: Props) {
  return (
    <aside className="w-[280px] shrink-0 bg-[var(--bg-card)] border-r border-[var(--border-soft)] flex flex-col">
      <SidebarHeader onNewChat={onNewChat} onCollapse={onCollapse} disabled={newChatDisabled} />
      <SidebarNavRows />
      <div className="flex-1 overflow-y-auto py-2">
        <SessionList
          activeSessionId={activeSessionId}
          pinnedIds={pinnedIds}
          onSelect={onSelectSession}
          onTogglePin={onTogglePin}
        />
      </div>
    </aside>
  );
}
```

- [ ] **Step 2: Run** `pnpm typecheck`. Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add components/shell/LeftSidebar.tsx
git commit -m "feat(shell): LeftSidebar assembles header + nav + session list"
```

---

## Task 15: `RightDrawer` and `SidebarToggleOverlay`

**Files:**
- Create: `components/shell/RightDrawer.tsx`, `components/shell/RightDrawer.test.tsx`
- Create: `components/shell/SidebarToggleOverlay.tsx`

- [ ] **Step 1: Test** at `components/shell/RightDrawer.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RightDrawer } from "./RightDrawer";

describe("RightDrawer", () => {
  it("renders Desk and Note section headers", () => {
    render(<RightDrawer onCollapse={() => {}} />);
    expect(screen.getByText("Desk")).toBeInTheDocument();
    expect(screen.getByText("Note")).toBeInTheDocument();
  });
  it("calls onCollapse when collapse button clicked", async () => {
    const onCollapse = vi.fn();
    render(<RightDrawer onCollapse={onCollapse} />);
    await userEvent.click(screen.getByRole("button", { name: /collapse desk/i }));
    expect(onCollapse).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Implement `components/shell/RightDrawer.tsx`**

```tsx
"use client";

type Props = { onCollapse: () => void };

export function RightDrawer({ onCollapse }: Props) {
  return (
    <aside className="w-[320px] shrink-0 bg-[var(--bg-card)] border-l border-[var(--border-soft)] flex flex-col">
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border-soft)]">
        <div className="font-medium text-sm">Desk</div>
        <button
          type="button"
          onClick={onCollapse}
          aria-label="Collapse desk"
          className="w-7 h-7 rounded-lg hover:bg-[var(--bg-hover)] grid place-items-center"
        >
          <span className="text-sm">›</span>
        </button>
      </div>
      <div className="flex-1 px-3 py-6 text-center text-sm text-[var(--text-faint)]">
        No files yet. Coming in v1.3.
      </div>
      <div className="border-t border-[var(--border-soft)] px-3 py-2 font-medium text-sm">Note</div>
      <div className="px-3 py-6 text-sm text-[var(--text-faint)]">
        Notes about your desk land here. v1.3.
      </div>
    </aside>
  );
}
```

- [ ] **Step 3: Implement `components/shell/SidebarToggleOverlay.tsx`** (no test — trivial markup):

```tsx
"use client";

type Props = {
  side: "left" | "right";
  onClick: () => void;
};

export function SidebarToggleOverlay({ side, onClick }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={side === "left" ? "Open sidebar" : "Open desk"}
      className={`fixed top-3 ${side === "left" ? "left-3" : "right-3"} z-20 w-9 h-9 rounded-full bg-[var(--bg-elevated)] border border-[var(--border-soft)] shadow-sm grid place-items-center hover:bg-[var(--bg-hover)]`}
    >
      <span className="text-base">{side === "left" ? "›" : "‹"}</span>
    </button>
  );
}
```

- [ ] **Step 4: Run, expect 2 PASS**

- [ ] **Step 5: Commit**

```bash
git add components/shell/RightDrawer.tsx components/shell/RightDrawer.test.tsx components/shell/SidebarToggleOverlay.tsx
git commit -m "feat(shell): RightDrawer with Desk/Note stubs + toggle overlay button"
```

---

## Task 16: `TopBar`

**Files:**
- Create: `components/shell/TopBar.tsx`, `components/shell/TopBar.test.tsx`

- [ ] **Step 1: Test**

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TopBar } from "./TopBar";

describe("TopBar", () => {
  it("renders Chat and Channels tabs and highlights active", () => {
    render(<TopBar tab="chat" onTabChange={() => {}} leftOpen={true} rightOpen={true} onToggleLeft={() => {}} onToggleRight={() => {}} />);
    expect(screen.getByRole("button", { name: /^chat$/i })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("button", { name: /^channels$/i })).toHaveAttribute("aria-selected", "false");
  });
  it("calls onTabChange when a tab is clicked", async () => {
    const onTabChange = vi.fn();
    render(<TopBar tab="chat" onTabChange={onTabChange} leftOpen={true} rightOpen={true} onToggleLeft={() => {}} onToggleRight={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: /channels/i }));
    expect(onTabChange).toHaveBeenCalledWith("channels");
  });
  it("calls onToggleLeft when left toggle clicked", async () => {
    const onToggleLeft = vi.fn();
    render(<TopBar tab="chat" onTabChange={() => {}} leftOpen={true} rightOpen={true} onToggleLeft={onToggleLeft} onToggleRight={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: /toggle left/i }));
    expect(onToggleLeft).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Implement `components/shell/TopBar.tsx`**

```tsx
"use client";
import type { Tab } from "@/hooks/useActiveTab";

type Props = {
  tab: Tab;
  onTabChange: (t: Tab) => void;
  leftOpen: boolean;
  rightOpen: boolean;
  onToggleLeft: () => void;
  onToggleRight: () => void;
};

export function TopBar({ tab, onTabChange, leftOpen, rightOpen, onToggleLeft, onToggleRight }: Props) {
  return (
    <div className="h-14 shrink-0 flex items-center px-3 border-b border-[var(--border-soft)] bg-[var(--bg-base)]">
      <button
        type="button"
        aria-label="Toggle left sidebar"
        onClick={onToggleLeft}
        className="w-9 h-9 rounded-lg hover:bg-[var(--bg-hover)] grid place-items-center"
      >
        <span className="text-base">{leftOpen ? "‹" : "›"}</span>
      </button>
      <div className="flex-1 flex justify-center">
        <div className="inline-flex bg-[var(--bg-card)] border border-[var(--border-soft)] rounded-full p-0.5 text-sm">
          <TabButton current={tab} value="chat" label="Chat" onSelect={onTabChange} />
          <TabButton current={tab} value="channels" label="Channels" onSelect={onTabChange} />
        </div>
      </div>
      <button
        type="button"
        aria-label="Toggle right sidebar"
        onClick={onToggleRight}
        className="w-9 h-9 rounded-lg hover:bg-[var(--bg-hover)] grid place-items-center"
      >
        <span className="text-base">{rightOpen ? "›" : "‹"}</span>
      </button>
    </div>
  );
}

function TabButton({ current, value, label, onSelect }: { current: Tab; value: Tab; label: string; onSelect: (t: Tab) => void }) {
  const active = current === value;
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={() => onSelect(value)}
      className={`px-4 py-1 rounded-full transition-colors ${
        active ? "bg-[var(--bg-elevated)] text-[var(--text-primary)] shadow-sm" : "text-[var(--text-muted)]"
      }`}
    >
      {label}
    </button>
  );
}
```

- [ ] **Step 3: Run, expect 3 PASS**

- [ ] **Step 4: Commit**

```bash
git add components/shell/TopBar.tsx components/shell/TopBar.test.tsx
git commit -m "feat(shell): TopBar with Chat/Channels tabs and sidebar toggles"
```

---

## Task 17: Restyle `Composer`, `Message`, `StreamingMessage`

**Files:**
- Modify: `components/chat/Composer.tsx`
- Modify: `components/chat/Message.tsx`
- Modify: `components/chat/StreamingMessage.tsx`

The existing component tests don't change (they test behavior, not styling). Apply the style changes. Tests must keep passing.

- [ ] **Step 1: Replace `components/chat/Composer.tsx`**

```tsx
"use client";
import { useState, type KeyboardEvent } from "react";

type Props = { onSend: (text: string) => void; disabled: boolean; modelLabel?: string };

export function Composer({ onSend, disabled, modelLabel }: Props) {
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
    <div className="px-6 pb-6">
      <div className="rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-soft)] p-3 shadow-sm">
        <textarea
          className="w-full resize-none bg-transparent outline-none text-sm placeholder:text-[var(--text-faint)] disabled:opacity-50"
          rows={2}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={disabled}
          placeholder={disabled ? "Gateway unavailable" : "Type a message… (⌘/Ctrl-Enter to send)"}
        />
        <div className="flex items-center justify-between pt-2">
          <span className="text-xs text-[var(--text-faint)]">{modelLabel ?? ""}</span>
          <button
            type="button"
            onClick={submit}
            disabled={disabled || !text.trim()}
            className="px-3 py-1.5 rounded-full bg-[var(--accent)] text-white text-sm disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Replace `components/chat/Message.tsx`**

```tsx
"use client";
import type { ChatMessage } from "@/hooks/useChat";
import { Markdown } from "@/components/render/Markdown";
import { ToolCallPanel } from "@/components/agent-trace/ToolCallPanel";
import { ThinkingPanel } from "@/components/agent-trace/ThinkingPanel";

export function Message({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  const align = isUser ? "items-end" : "items-start";
  const bubble = isUser
    ? "bg-[var(--accent-soft)] text-[var(--accent)] rounded-2xl px-4 py-2"
    : "bg-transparent text-[var(--text-primary)]";
  return (
    <div className={`flex flex-col ${align} my-3 px-6`}>
      <div className={`max-w-[80%] ${bubble}`}>
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

- [ ] **Step 3: Replace `components/chat/StreamingMessage.tsx`**

```tsx
"use client";
import type { ChatMessage } from "@/hooks/useChat";
import { Message } from "./Message";

export function StreamingMessage({ message }: { message: ChatMessage }) {
  return (
    <div className="relative">
      <Message message={message} />
      <span className="absolute bottom-1 left-8 text-xs text-[var(--text-faint)] animate-pulse">streaming…</span>
    </div>
  );
}
```

- [ ] **Step 4: Run** `pnpm test components/chat/`. Expected: existing chat tests still pass.

- [ ] **Step 5: Commit**

```bash
git add components/chat/
git commit -m "feat(chat): restyle Composer, Message, StreamingMessage to cream theme"
```

---

## Task 18: `ChatView` and `AppShell`

**Files:**
- Create: `components/shell/ChatView.tsx`
- Create: `components/shell/AppShell.tsx`
- Modify: `app/page.tsx`
- Delete: `app/ChatPage.tsx`

- [ ] **Step 1: Create `components/shell/ChatView.tsx`**

```tsx
"use client";
import { MessageList } from "@/components/chat/MessageList";
import { Composer } from "@/components/chat/Composer";
import { EmptyHero } from "@/components/shell/EmptyHero";
import { useChat } from "@/hooks/useChat";

type Props = {
  sessionId: string | null;
  selectedAgent: string;
  onSelectAgent: (id: string) => void;
  modelLabel?: string;
  composerDisabled: boolean;
};

export function ChatView({ sessionId, selectedAgent, onSelectAgent, modelLabel, composerDisabled }: Props) {
  if (!sessionId) {
    return <EmptyHero selectedAgent={selectedAgent} onSelectAgent={onSelectAgent} />;
  }
  return <ActiveChat sessionId={sessionId} modelLabel={modelLabel} composerDisabled={composerDisabled} />;
}

function ActiveChat({ sessionId, modelLabel, composerDisabled }: { sessionId: string; modelLabel?: string; composerDisabled: boolean }) {
  const { messages, status, send } = useChat(sessionId);
  return (
    <div className="flex-1 flex flex-col min-h-0">
      <MessageList messages={messages} status={status} />
      <Composer
        onSend={send}
        disabled={composerDisabled || status === "streaming"}
        modelLabel={modelLabel}
      />
    </div>
  );
}
```

- [ ] **Step 2: Create `components/shell/AppShell.tsx`**

```tsx
"use client";
import { useCallback, useEffect, useState } from "react";
import { TopBar } from "./TopBar";
import { LeftSidebar } from "./LeftSidebar";
import { RightDrawer } from "./RightDrawer";
import { SidebarToggleOverlay } from "./SidebarToggleOverlay";
import { ChatView } from "./ChatView";
import { ChannelsComingSoon } from "./ChannelsComingSoon";
import { StatusBanner } from "@/components/connection/StatusBanner";
import { useSidebarState } from "@/hooks/useSidebarState";
import { useActiveTab } from "@/hooks/useActiveTab";
import { usePinnedSessions } from "@/hooks/usePinnedSessions";
import { useGatewayHealth } from "@/hooks/useGatewayHealth";

export function AppShell() {
  const sidebars = useSidebarState();
  const { tab, setTab } = useActiveTab();
  const { isPinned, togglePin } = usePinnedSessions();
  const health = useGatewayHealth();
  const gatewayDown = health !== null && !health.ok;

  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<string>("main");
  const [refreshNonce, setRefreshNonce] = useState(0);

  // Read ?session=<key> from URL on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    setActiveSessionId(sp.get("session"));
  }, []);

  const setActive = useCallback((id: string | null) => {
    setActiveSessionId(id);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (id) url.searchParams.set("session", id);
      else url.searchParams.delete("session");
      window.history.replaceState(null, "", url);
    }
  }, []);

  const onNewChat = useCallback(async () => {
    if (gatewayDown) return;
    try {
      const r = await fetch("/api/sessions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({}) });
      if (!r.ok) return;
      const j = await r.json();
      setActive(j.id);
      setRefreshNonce((n) => n + 1);
    } catch { /* non-fatal */ }
  }, [gatewayDown, setActive]);

  const pinnedSet = new Set<string>();
  // Materialize pinned set lazily — we only need .has()
  const pinnedAdapter = { has: (id: string) => isPinned(id), add: () => undefined, delete: () => undefined } as unknown as Set<string>;
  void pinnedSet;

  return (
    <div className="h-full flex flex-col">
      <StatusBanner />
      <TopBar
        tab={tab}
        onTabChange={setTab}
        leftOpen={sidebars.left}
        rightOpen={sidebars.right}
        onToggleLeft={sidebars.toggleLeft}
        onToggleRight={sidebars.toggleRight}
      />
      <div className="flex-1 flex overflow-hidden">
        {sidebars.left ? (
          <LeftSidebar
            key={refreshNonce}
            activeSessionId={activeSessionId}
            pinnedIds={pinnedAdapter}
            onSelectSession={setActive}
            onTogglePin={togglePin}
            onNewChat={onNewChat}
            onCollapse={sidebars.toggleLeft}
            newChatDisabled={gatewayDown}
          />
        ) : (
          <SidebarToggleOverlay side="left" onClick={sidebars.toggleLeft} />
        )}
        <main className="flex-1 flex flex-col min-w-0">
          {tab === "chat" ? (
            <ChatView
              sessionId={activeSessionId}
              selectedAgent={selectedAgent}
              onSelectAgent={setSelectedAgent}
              composerDisabled={gatewayDown}
            />
          ) : (
            <ChannelsComingSoon />
          )}
        </main>
        {sidebars.right ? (
          <RightDrawer onCollapse={sidebars.toggleRight} />
        ) : (
          <SidebarToggleOverlay side="right" onClick={sidebars.toggleRight} />
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Modify `app/page.tsx`** (replace contents)

```tsx
import { redirect } from "next/navigation";
import { getClient } from "@/lib/openclaw";
import { AppShell } from "@/components/shell/AppShell";

export default async function Page() {
  const c = getClient();
  if (!c) redirect("/setup");
  return <AppShell />;
}
```

- [ ] **Step 4: Delete the old `app/ChatPage.tsx`**

```bash
rm app/ChatPage.tsx
```

- [ ] **Step 5: Run** `pnpm typecheck && pnpm test`. Both must pass.

- [ ] **Step 6: Commit**

```bash
git add app/page.tsx components/shell/ChatView.tsx components/shell/AppShell.tsx
git rm app/ChatPage.tsx
git commit -m "feat(shell): AppShell + ChatView assemble the openhanako-style layout"
```

---

## Task 19: Wire `pinnedIds` real Set into `AppShell`

The Task 18 step used a hacky adapter. Replace with a proper materialized Set.

**Files:**
- Modify: `components/shell/AppShell.tsx`

- [ ] **Step 1: Update `usePinnedSessions`** to also expose the underlying set:

In `hooks/usePinnedSessions.ts`, change the returned object to:

```ts
return { isPinned, togglePin, pinnedIds: pinned };
```

- [ ] **Step 2: Modify `AppShell.tsx`** — replace the `pinnedAdapter` block with:

```ts
const { isPinned: _isPinned, togglePin, pinnedIds } = usePinnedSessions();
void _isPinned;
```

And in the `<LeftSidebar pinnedIds={...} />` call, pass `pinnedIds` directly.

Remove the `void pinnedSet` and `const pinnedSet = new Set<string>();` lines.

- [ ] **Step 3: Update `usePinnedSessions.test.tsx`** to reflect the new return shape:

Replace usage of `result.current.isPinned("s1")` with `result.current.pinnedIds.has("s1")` in the tests where appropriate; keep `togglePin` calls. (The `isPinned` and `togglePin` API stays for ergonomics.)

- [ ] **Step 4: Run** `pnpm test hooks/ components/shell/`. All pass.

- [ ] **Step 5: Commit**

```bash
git add hooks/usePinnedSessions.ts hooks/usePinnedSessions.test.tsx components/shell/AppShell.tsx
git commit -m "refactor(shell): use real Set for pinnedIds instead of adapter"
```

---

## Task 20: Manual verification + final pass

This task does NOT add code — it verifies the v1.2 shell against the running gateway and runs all checks.

- [ ] **Step 1: Run all checks**

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm build && pnpm test:e2e
```

All must pass. If `pnpm lint` flags new warnings, fix them with targeted edits.

- [ ] **Step 2: Restart dev server and verify**

The preview server may already be running. Restart it via `mcp__Claude_Preview__preview_start name=next-dev`. Then via curl:

```bash
sleep 5
/usr/bin/curl -sf http://localhost:3001/api/agents | python3 -m json.tool | head
/usr/bin/curl -sf -X POST -H "content-type: application/json" -d '{"label":"v1.2 test"}' http://localhost:3001/api/sessions | python3 -m json.tool
/usr/bin/curl -sf http://localhost:3001/api/sessions | python3 -m json.tool | head -20
```

Expected: agents list returns `main`; POST creates a session with `web:` prefix; subsequent GET shows the new session.

- [ ] **Step 3: Update README**

Append to README under the existing "How it talks to openclaw" section:

```markdown
## Sessions

clawapp creates new sessions via openclaw's `sessions.create` and stores them in `~/.openclaw/agents/<agentId>/sessions/<uuid>.jsonl` — the same place CLI and Telegram sessions live. clawapp-created sessions use the key prefix `web:<uuid>` to distinguish them. The session label auto-updates from the first message you send (max 40 chars). Sessions you pin from the sidebar are kept in browser localStorage (per-device) until v1.3 surfaces a server-side pin store.
```

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: README — describe v1.2 session creation and pinning"
```

- [ ] **Step 5: Final report**

Report:
- Total commits on branch since main: `git log --oneline main..HEAD | wc -l`
- Final unit + e2e test counts
- All checks passing? (typecheck/lint/test/build/test:e2e)
- Manual verification result (sessions create, agents list, sidebar populates)
- Any concerns for v1.3
