import { randomUUID } from "node:crypto";
import type { StreamEvent } from "./events";
import { parseTranscriptEvent, extractMessageText } from "./events";
import { adaptTranscriptEvent, initialAdapterState } from "./adapter";
import type { GatewayConnection } from "./connection";
import { appSessionKey, newFamilyKey, orderFamily } from "./sessionFamily";

export type SessionSummary = { id: string; title: string; updatedAt?: number };
export type Message = { role: "user" | "assistant" | "system" | "divider"; text: string; at: number };

/**
 * Stable per-agent session key for app-owned chats. Mirrors how the gateway keys
 * Telegram sessions (`agent:<name>:telegram:…`): the `app:` prefix marks a chat as
 * owned by THIS desktop app so it never shares a transcript with another surface.
 * Sharing one transcript across surfaces thrashes the prompt cache — each surface
 * injects its own channel context near the front of the prompt, so alternating
 * between them invalidates the cached prefix every turn. One key per surface keeps
 * each transcript's warm prefix intact. Session-key helpers live in
 * ./sessionFamily (an agent now owns a *chain* of app sessions; `/new` mints a
 * fresh member and the newest is active).
 */
export type AgentThread = { activeId: string; messages: Message[] };

// A row is shown only if it's a real user/assistant turn. Drops empties plus
// runtime control rows the gateway records but the UI shouldn't surface: the
// startup-context bootstrap and stray /new|/reset command echoes (matches how
// openclaw's web chat display-normalizes the transcript).
function isDisplayableRow(m: Message): boolean {
  if (m.role !== "user" && m.role !== "assistant") return false;
  const t = (m.text || "").trim();
  if (!t) return false;
  if (t.startsWith("[Startup context loaded by runtime]")) return false;
  if (/^\/(new|reset)\b/.test(t)) return false;
  return true;
}

export type AgentSummary = { id: string; label: string; model?: string };

export type ModelSummary = {
  id: string;       // canonical id, e.g. "kimi/kimi-code"
  label: string;    // human-friendly name (alias if available, else id)
  provider?: string;
  isDefault: boolean;
};

export type Client = {
  listSessions(): Promise<SessionSummary[]>;
  getHistory(sessionId: string): Promise<Message[]>;
  health(): Promise<{ ok: boolean; reason?: string }>;
  sendMessage(sessionId: string, text: string, signal?: AbortSignal): AsyncIterable<StreamEvent>;
  listAgents(): Promise<AgentSummary[]>;
  createSession(opts?: { label?: string; agentId?: string }): Promise<SessionSummary>;
  resolveAgentSession(agentId: string): Promise<SessionSummary>;
  listAgentSessions(agentId: string): Promise<SessionSummary[]>;
  createAgentSession(agentId: string): Promise<SessionSummary>;
  getAgentThread(agentId: string): Promise<AgentThread>;
  patchSessionLabel(sessionId: string, label: string): Promise<void>;
  deleteSession(sessionId: string): Promise<void>;
  listModels(): Promise<ModelSummary[]>;
  listCommands(agentId?: string): Promise<SlashCommand[]>;
};

// A slash command available to an agent. `source` is "skill" | "extension" |
// "prompt" — the gateway surfaces skills as slash commands too, so one
// `commands.list` covers both commands and skills.
export type SlashCommand = { name: string; description?: string; source?: string };

type RawSessionRow = {
  key: string;
  displayName?: string;
  derivedTitle?: string;
  label?: string;
  updatedAt?: number;
};

type RawMessage = {
  role?: string;
  content?: string | { type: string; text?: string }[];
  text?: string;
  timestamp?: number;
  at?: number;
};

function normalizeRole(role: string | undefined): Message["role"] {
  if (role === "user" || role === "assistant" || role === "system") return role;
  // Tool results, system compaction, etc. surface as system rows in our normalized view.
  return "system";
}

export function createClient(conn: GatewayConnection): Client {
  async function listSessions(): Promise<SessionSummary[]> {
    const p = await conn.invoke("sessions.list", { includeDerivedTitles: true }) as { sessions?: RawSessionRow[] };
    return (p?.sessions ?? []).map((s) => ({
      id: s.key,
      title: s.displayName ?? s.derivedTitle ?? s.label ?? s.key,
      updatedAt: s.updatedAt,
    }));
  }

  async function getHistory(sessionId: string): Promise<Message[]> {
    const p = await conn.invoke("chat.history", { sessionKey: sessionId }) as { messages?: RawMessage[] };
    return (p?.messages ?? []).map((m) => ({
      role: normalizeRole(m.role),
      text: extractMessageText({ content: m.content, text: m.text }),
      at: m.timestamp ?? m.at ?? 0,
    }));
  }

  async function health(): Promise<{ ok: boolean; reason?: string }> {
    try {
      await conn.invoke("health", {});
      return { ok: true };
    } catch (e) {
      return { ok: false, reason: (e as Error).message };
    }
  }

  async function* sendMessage(
    sessionId: string,
    text: string,
    signal?: AbortSignal,
  ): AsyncIterable<StreamEvent> {
    const sub = conn.subscribe(sessionId);
    let state = initialAdapterState();
    let aborted = false;

    if (signal) {
      if (signal.aborted) {
        await sub.unsubscribe();
        yield { type: "error", message: "aborted" };
        return;
      }
      signal.addEventListener("abort", () => {
        aborted = true;
        conn.invoke("chat.abort", { sessionKey: sessionId }).catch(() => undefined);
      }, { once: true });
    }

    // Fire chat.send concurrently — don't await; chat events drive completion.
    conn.invoke("chat.send", {
      sessionKey: sessionId,
      message: text,
      idempotencyKey: randomUUID(),
    }).catch(() => undefined);

    try {
      for await (const ev of sub.events) {
        if (aborted) {
          yield { type: "error", message: "aborted" };
          return;
        }
        const te = parseTranscriptEvent(ev.event, ev.payload);
        if (!te) continue;
        const r = adaptTranscriptEvent(te, state);
        state = r.next;
        for (const out of r.out) {
          yield out;
          if (out.type === "done" || out.type === "error") return;
        }
      }
    } finally {
      await sub.unsubscribe();
    }
  }

  async function listAgents(): Promise<AgentSummary[]> {
    const p = await conn.invoke("agents.list", {}) as { agents?: { id?: string; label?: string; displayName?: string; name?: string; model?: string }[] };
    return (p?.agents ?? []).map((a) => ({
      id: a.id ?? "",
      label: a.label ?? a.displayName ?? a.name ?? a.id ?? "",
      model: a.model,
    }));
  }

  async function createSession(opts?: { label?: string; agentId?: string }): Promise<SessionSummary> {
    const uuid = randomUUID();
    const key = `web:${uuid}`;
    // openclaw rejects duplicate labels; suffix the default so concurrent "New chat"
    // creations don't collide. The auto-label flow rewrites this on first message.
    const label = opts?.label ?? `New chat ${uuid.slice(0, 4)}`;
    const p = await conn.invoke("sessions.create", {
      key,
      agentId: opts?.agentId ?? "main",
      label,
    }) as { key?: string; displayName?: string; derivedTitle?: string; label?: string };
    return {
      id: p.key ?? key,
      title: p.displayName ?? p.derivedTitle ?? p.label ?? label,
    };
  }

  // The agent's app-session chain, oldest→newest (the last is the active one).
  async function listAgentSessions(agentId: string): Promise<SessionSummary[]> {
    return orderFamily(await listSessions(), agentId);
  }

  // Resolve to the agent's ACTIVE (newest) app session, creating the original
  // `app:<agent>` if the chain is empty. Targets a session the gateway already
  // knows about, so history/subscribe land on a real transcript.
  async function resolveAgentSession(agentId: string): Promise<SessionSummary> {
    const family = await listAgentSessions(agentId);
    if (family.length > 0) return family[family.length - 1];
    const key = appSessionKey(agentId);
    const p = await conn.invoke("sessions.create", {
      key, agentId, label: agentId,
    }) as { key?: string; displayName?: string; derivedTitle?: string; label?: string };
    return { id: p.key ?? key, title: p.displayName ?? p.derivedTitle ?? p.label ?? agentId };
  }

  // "/new" — mint a fresh chain member (time-stamped key) and make it active.
  // A brand-new session = genuinely zero context; the prior members stay listed
  // and are stitched above the divider for display.
  async function createAgentSession(agentId: string): Promise<SessionSummary> {
    const now = Date.now();
    const key = newFamilyKey(agentId, now);
    // The gateway rejects duplicate labels, and the original member already holds
    // `<agentId>` — so stamp successors uniquely. The label isn't surfaced (the
    // sidebar shows the agent, not the session title).
    const p = await conn.invoke("sessions.create", {
      key, agentId, label: `${agentId} ${now}`,
    }) as { key?: string; displayName?: string; derivedTitle?: string; label?: string };
    return { id: p.key ?? key, title: p.displayName ?? p.derivedTitle ?? p.label ?? agentId };
  }

  // The agent's full thread: every chain member's transcript stitched
  // oldest→newest with a "New session started" divider at each boundary, plus the
  // active session id (where new turns go). Reload-/multi-device-safe — the chain
  // and its order come entirely from the gateway (no client state).
  async function getAgentThread(agentId: string): Promise<AgentThread> {
    const family = await listAgentSessions(agentId);
    if (family.length === 0) {
      const created = await resolveAgentSession(agentId);
      return { activeId: created.id, messages: [] };
    }
    const histories = await Promise.all(family.map((s) => getHistory(s.id)));
    const messages: Message[] = [];
    histories.forEach((rows, i) => {
      if (i > 0) messages.push({ role: "divider", text: "New session started", at: 0 });
      for (const r of rows) if (isDisplayableRow(r)) messages.push(r);
    });
    return { activeId: family[family.length - 1].id, messages };
  }

  async function patchSessionLabel(sessionId: string, label: string): Promise<void> {
    await conn.invoke("sessions.patch", { key: sessionId, label });
  }

  async function deleteSession(sessionId: string): Promise<void> {
    await conn.invoke("sessions.delete", { key: sessionId, deleteTranscript: true });
  }

  async function listModels(): Promise<ModelSummary[]> {
    const p = await conn.invoke("models.list", { view: "configured" }) as {
      models?: { id?: string; alias?: string; label?: string; displayName?: string; provider?: string; default?: boolean; isDefault?: boolean }[];
      defaultModel?: string;
      primary?: string;
    };
    const rows = p?.models ?? [];
    const defaultId = p?.defaultModel ?? p?.primary ?? rows.find((m) => m.default || m.isDefault)?.id;
    return rows
      .filter((m) => m.id)
      .map((m) => ({
        id: m.id!,
        label: m.alias ?? m.label ?? m.displayName ?? m.id!,
        provider: m.provider,
        isDefault: m.id === defaultId,
      }));
  }

  // Available slash commands (incl. skills, which the gateway exposes as
  // commands) for an agent — powers the composer's "/" autocomplete.
  async function listCommands(agentId?: string): Promise<SlashCommand[]> {
    const p = await conn.invoke("commands.list", {
      ...(agentId ? { agentId } : {}), scope: "text", includeArgs: false,
    }) as { commands?: { name?: string; description?: string; source?: string }[] };
    return (p?.commands ?? [])
      .filter((c): c is { name: string; description?: string; source?: string } => !!c.name)
      .map((c) => ({ name: c.name, description: c.description, source: c.source }));
  }

  return { listSessions, getHistory, health, sendMessage, listAgents, createSession, resolveAgentSession, listAgentSessions, createAgentSession, getAgentThread, patchSessionLabel, deleteSession, listModels, listCommands };
}
