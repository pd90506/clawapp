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

  // sendMessage WS streaming will be added in Task 6.
  async function* sendMessage(): AsyncIterable<StreamEvent> {
    throw new Error("not implemented yet");
  }

  return { listSessions, getHistory, health, sendMessage };
}
