# clawapp v1.2 — openhanako-style shell

**Status:** design approved 2026-05-08
**Scope:** UI shell overhaul. Three-column layout, cream-warm theme, tabs, agent picker, new-chat flow. Frontend-heavy; one new server route. Backend protocol unchanged.

## Goal

Replace the current two-column functional layout with a three-column shell modeled on openhanako's visual language: cream-warm theme, top tabs (Chat / Channels), grouped session cards in the left sidebar with new-chat support, and a togglable right drawer with stub Desk/Note panels. Agent picker chip at the chat empty state, fed live from the gateway.

## Non-goals (v1.2)

- Real Channels content (tab is a coming-soon stub).
- Real Desk file browser or Note storage (right drawer is a visual stub).
- Settings modal, Activity panel, Tasks panel — sidebar items render as disabled placeholders.
- Inline session rename (auto-label from first message instead).
- Real agent switching (picker is visual; clawapp-created sessions always target `main` for now).
- New session via `?tab=channels` deep-link parsing beyond simple show/hide.
- Composer mode chips ("Computer use", "Watch desk").

## Visual language

A new **cream-warm light theme** layered on top of Tailwind CSS variables. Tokens (CSS custom properties on `:root`):

```
--bg-base:        #f6f1e7   /* page background */
--bg-card:        #fbf7ee   /* sidebars, panels */
--bg-elevated:    #ffffff   /* composer, input cards, modal surfaces */
--bg-hover:       rgba(60, 40, 20, 0.04)
--bg-active:      rgba(60, 40, 20, 0.08)
--border-soft:    rgba(60, 40, 20, 0.08)
--text-primary:   #2c3142
--text-muted:     #7a7568
--text-faint:     #a39d8c
--accent:         #4a6b8a   /* muted blue, matches the screenshot silhouette */
--accent-soft:    #d8e2eb   /* selected chip backgrounds */
```

A `.dark` variant inverts: `--bg-base: #18181b` (zinc-900), `--bg-card: #27272a`, accents shift to `#7aa3c8`. Existing dark mode behavior (via `prefers-color-scheme`) is preserved.

Global typography stays system-sans. Headings get `font-medium tracking-tight`. Card corners are `rounded-2xl`; chips are `rounded-full`. Borders are 1px in `--border-soft`. Whitespace leans generous (16-24px gutters between sections).

## Layout shell

Single client-rendered shell at full viewport height, always present:

```
┌────────────────────────────────────────────────────────────┐
│  [⌃ left toggle]   [ Chat | Channels ]   [⌃ right toggle]  │  56px
├──────────┬─────────────────────────────────────┬───────────┤
│ Chats  + │                                     │  Desk     │
│   ⚙   <  │                                     │  ─────    │
│ ──────── │                                     │           │
│ link     │     (chat content OR empty-hero     │  (empty)  │
│ ⚡ Act.  │      OR coming-soon for Channels)   │           │
│ ⏱ Tasks │                                     ├───────────┤
│ ──────── │                                     │  Note     │
│ Pinned   │                                     │  ─────    │
│ Today    │                                     │           │
│  [card]  │                                     │  (empty)  │
│  [card]  │                                     │           │
│ Yesterday│                                     │           │
│  [card]  │                                     │           │
│          │                                     │           │
└──────────┴─────────────────────────────────────┴───────────┘
   280px                  flex-1                    320px
```

Both side columns collapse to width 0 (display: none) when toggled off. Top bar stays. The respective toggle button moves to a fixed pill-button overlay so the user can re-open from anywhere.

## Tabs

Top-bar tabs `Chat` and `Channels` segmented control. State is the URL query parameter `?tab=chat|channels`. Default = `chat`.

- `chat` → main column shows `ChatView` (sessions + chat + composer).
- `channels` → main column shows `ChannelsComingSoon` — a centered card with the cream aesthetic: "Channels are coming. Connect Telegram, Slack, and other inboxes here." No backend calls in this view.

The left and right columns stay visible regardless of tab — they're shell-level chrome.

## New-chat flow & session storage

**Sessions live in openclaw, not in clawapp.** New chats become new openclaw sessions stored at `~/.openclaw/agents/<agentId>/sessions/<uuid>.jsonl`. We don't add a sidecar DB.

**Naming convention.** clawapp-created sessions use the key prefix `web:<uuid>` so they're visually distinguishable from CLI/Telegram sessions in `sessions.list`. The `<uuid>` portion is generated server-side via `crypto.randomUUID()`.

**New-chat flow:**

1. User clicks `+` in the sidebar.
2. Client `POST /api/sessions` (new route).
3. Server route invokes gateway `sessions.create({ key: "web:" + uuid, agentId: "main", label: "New chat" })`.
4. Server returns the new session row (`{ id, title }`) to the client.
5. Client refetches `sessions.list`, navigates to the new session.

**Auto-label from first message.** When the user sends the first message in a `New chat`, the server route handling that message (existing `/api/chat`) ALSO invokes `sessions.patch({ key, label: <first-40-chars-of-message> })` after `chat.send` succeeds. The label change is reflected on the next `sessions.list` refresh (sidebar polls every 30s; could add a `sessions.changed` subscription in v1.3).

## Pinned (local-only)

OpenClaw doesn't expose a pinned flag. v1.2 stores pin state client-side in `localStorage` under key `clawapp.pinned`: `Set<sessionKey>`. Right-click a session card → "Pin to top" / "Unpin". Pinned cards render under the **Pinned** section, ignoring time grouping. Across browsers / devices the pin state is local; v1.3 can move it to openclaw if a generic session-meta storage method is added.

## Session grouping

Sessions are grouped client-side by `updatedAt` (or fallback to `lastMessageAt` if openclaw exposes it; otherwise by the latest transcript message timestamp from a peek):

- **Pinned** (always first if non-empty)
- **Today** (≥ start of today)
- **Yesterday**
- **This week**
- **Older**

Sections with no entries are hidden.

## Agent picker (visual)

A pill-chip group rendered in the empty-state hero. Hydrated from a new `/api/agents` route → `agents.list` RPC.

- Each chip: small colored circle (deterministic from agent id) + agent label.
- Selecting a chip changes the chip highlight only — does NOT change which agent the next session targets in v1.2 (always `main`). When v1.3 wires real switching, this surface stays.
- If only one agent exists (your case today), the chip still renders.

## Components

```
components/
  shell/
    AppShell.tsx              # 3-column flex layout, owns sidebar collapse + tab state
    TopBar.tsx                # tabs + collapse toggles
    LeftSidebar.tsx           # whole left column
    RightDrawer.tsx           # whole right column with Desk / Note stubs
    SidebarToggleOverlay.tsx  # floating "open this sidebar" buttons when collapsed
    EmptyHero.tsx             # cream-style centered hero with agent picker + prompt
    ChannelsComingSoon.tsx    # centered card placeholder
  sidebar/
    SessionCard.tsx           # avatar/title/subtitle/bullet active state
    SessionGroup.tsx          # one section (Pinned, Today, …)
    SessionList.tsx           # groups + sections, owns the load
    SidebarHeader.tsx         # "Chats" + new + settings + collapse buttons
    SidebarNavRows.tsx        # ⚡ Activity / ⏱ Tasks placeholder rows
    PinContextMenu.tsx        # right-click menu on a session card
  agent/
    AgentPicker.tsx           # chip group, hydrates from /api/agents
    agentColor.ts             # deterministic color per agent id
  chat/
    Composer.tsx              # restyled — rounded-2xl card, model name in corner
    Message.tsx               # restyled bubbles, accent for user, soft card for assistant
    MessageList.tsx           # spacing tweaks
    StreamingMessage.tsx      # softer pulsating indicator
hooks/
  useSidebarState.ts          # localStorage-backed { left, right } collapse state
  useActiveTab.ts             # ?tab=chat|channels
  usePinnedSessions.ts        # localStorage-backed Set<sessionKey>
  useRelativeTime.ts          # tiny formatter (now / 2m / 3h / yesterday / Mon)
lib/
  theme.ts                    # token map, dark-mode helpers
  agentVisuals.ts             # agentId → { color, initial }
```

Files retired or absorbed:

- The current `app/ChatPage.tsx` becomes a thin wrapper that picks the right view inside `AppShell` based on tab + selected session. Most of its layout markup migrates to `AppShell` and `LeftSidebar`.
- `app/globals.css` is rewritten with the token CSS variables and a single `body { background: var(--bg-base) }` rule.

## Routes (server)

New:

- `GET /api/agents` — proxies `agents.list` from the gateway. Returns `{ agents: [{ id, label, model? }] }`.
- `POST /api/sessions` — body `{ label?: string }`. Server invokes `sessions.create({ key: "web:" + uuid, agentId: "main", label: label ?? "New chat" })`. Returns `{ id, title }`.

Modified:

- `POST /api/chat` (existing SSE route) — after `chat.send` succeeds for a session whose label is still `"New chat"`, fire-and-forget `sessions.patch({ key, label: text.slice(0, 40) })`. Don't block the SSE stream on this.

Unchanged:

- `GET /api/health`, `GET /api/sessions`, `GET /api/sessions/[id]`.

## Client surface for `Client`

The `Client` interface in `lib/openclaw/client.ts` gains two methods:

```ts
listAgents(): Promise<AgentSummary[]>;
createSession(opts?: { label?: string; agentId?: string }): Promise<SessionSummary>;
```

`AgentSummary = { id: string; label: string; model?: string }`. Implemented as `agents.list` and `sessions.create` RPCs through the existing `GatewayConnection`. The label-patch on first message is done by a new `patchSessionLabel(key, label)` method.

## State

| State | Source | Lifetime |
|---|---|---|
| Active session id | URL path `/?session=<key>` (or `/`) | URL |
| Active tab | URL `?tab=chat|channels` | URL |
| Sidebar collapse `{ left, right }` | localStorage `clawapp.sidebars` | persistent |
| Pinned sessions | localStorage `clawapp.pinned` | persistent |
| Sessions list | server fetch + 30s poll | per-session |
| Agents list | server fetch on AppShell mount | per-load |
| Chat messages | `useChat` (existing) | per-session |
| Health | `useGatewayHealth` (existing) | per-load |

## Theming details

`globals.css`:

```css
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
body { background: var(--bg-base); color: var(--text-primary); }
```

Component code uses Tailwind arbitrary-property syntax (`bg-[var(--bg-card)]`) or short utility wrappers in `lib/theme.ts`.

## Error handling

- `/api/agents` failure → AgentPicker renders with a single hardcoded "Default" chip and logs to console. Non-blocking.
- `/api/sessions` POST failure → New-chat button shows a transient red dot; user can retry.
- Gateway down → existing StatusBanner already covers this; new-chat button disabled when gateway down.
- Session list fetch failure → sidebar shows "Couldn't load sessions" inline with a retry link.

## Testing

New unit tests:

- `useSidebarState` — defaults, toggle, persistence.
- `useActiveTab` — query-param read/write.
- `usePinnedSessions` — set/get persistence.
- `useRelativeTime` — boundary cases (now / 1m / 23h / yesterday / 5d ago / 2026-05-01).
- `SessionCard` — renders title, subtitle, active state, pin context menu.
- `SessionGroup` — renders only sections that have entries.
- `SessionList` — groups sessions correctly across boundaries; pinned wins.
- `AgentPicker` — renders chips, hydrates from fetch, click changes selection.
- `EmptyHero` — renders prompt + picker.
- `TopBar` — toggles wired to state; tab clicks update query.
- `RightDrawer` — collapse hides; placeholder content present when open.
- `app/api/agents/route.test.ts` — 503 on no-config, returns array on success.
- `app/api/sessions/route.test.ts` — POST creates session, returns id+title.

Existing tests stay green. Playwright smoke continues to pass; we add one assertion: clicking the right-sidebar toggle hides the desk panel.

## Out-of-scope follow-ups

- Real Channels (v1.3 — surface openclaw channel inboxes).
- Real Desk + Note (v1.3+ — needs file APIs and note storage).
- Settings modal (v1.3).
- Activity panel + Tasks panel.
- Multi-agent switching wired through.
- `sessions.changed` event subscription for live sidebar updates (replace 30s poll).
- Session rename (inline edit on title).
- Pinned state in openclaw rather than localStorage.

## Assumptions to verify during implementation

1. **`sessions.create` returns the canonical session row** in its `res.payload`. If not, we follow up with `sessions.describe({key})` to fetch it. Either way, `Client.createSession` returns `SessionSummary`.
2. **`sessions.patch({ key, label })` applies the label and the next `sessions.list` reflects it.** If patch is async without polling, expose a small wait or rely on the 30s poll.
3. **`agents.list` returns each agent with at least `id` and a human-readable name.** If the field is `name` rather than `label`, adapt in the route.
4. **Time grouping uses `updatedAt`.** If `sessions.list` rows don't have `updatedAt`, fall back to the highest message timestamp, or to a "lastSeenAtMs"-style field if present.
