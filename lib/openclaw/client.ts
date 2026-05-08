import { randomUUID } from "node:crypto";
import type { StreamEvent } from "./events";
import { parseTranscriptEvent, extractMessageText } from "./events";
import { adaptTranscriptEvent, initialAdapterState } from "./adapter";
import type { GatewayConnection } from "./connection";

export type SessionSummary = { id: string; title: string };
export type Message = { role: "user" | "assistant" | "system"; text: string; at: number };

export type AgentSummary = { id: string; label: string; model?: string };

export type Client = {
  listSessions(): Promise<SessionSummary[]>;
  getHistory(sessionId: string): Promise<Message[]>;
  health(): Promise<{ ok: boolean; reason?: string }>;
  sendMessage(sessionId: string, text: string, signal?: AbortSignal): AsyncIterable<StreamEvent>;
  listAgents(): Promise<AgentSummary[]>;
  createSession(opts?: { label?: string; agentId?: string }): Promise<SessionSummary>;
  patchSessionLabel(sessionId: string, label: string): Promise<void>;
};

type RawSessionRow = {
  key: string;
  displayName?: string;
  derivedTitle?: string;
  label?: string;
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

  return { listSessions, getHistory, health, sendMessage, listAgents, createSession, patchSessionLabel };
}
