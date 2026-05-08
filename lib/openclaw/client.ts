import WebSocket from "ws";
import type { GatewayConfig } from "./config";
import type { StreamEvent } from "./events";
import { parseStreamEvent } from "./events";

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
        closed = true;
      }
      wake();
    });
    ws.on("error", (e) => {
      queue.push({ type: "error", message: (e as Error).message });
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
    }
  }

  return { listSessions, getHistory, health, sendMessage };
}
