"use client";
import { useCallback, useEffect, useReducer, useRef } from "react";
import { parseSseChunks } from "./sseParse";
import { familyAgentId } from "@/lib/openclaw/sessionFamily";

export type Block =
  | { kind: "text"; md: string }
  | { kind: "tool_call"; id: string; name: string; args: unknown; result?: unknown; error?: string; done: boolean }
  | { kind: "thinking"; text: string; done: boolean; detail?: string[] };

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  blocks: Block[];
  error?: string;
  // When set, this row renders as a centered "New session started" divider
  // instead of a message bubble (see MessageList). It marks a session boundary
  // in the agent's stitched thread — prior sessions sit above, the fresh
  // (zero-context) session below.
  divider?: string;
};

export type Status = "idle" | "streaming" | "error";

type ChatState = { messages: ChatMessage[]; status: Status };
type ChatAction =
  | { type: "reset" }
  | { type: "loadHistory"; messages: ChatMessage[] }
  | { type: "appendMessages"; userMsg: ChatMessage; asst: ChatMessage }
  | { type: "appendDivider"; divider: ChatMessage }
  | { type: "updateLast"; fn: (m: ChatMessage) => ChatMessage }
  | { type: "setStatus"; status: Status };

const DIVIDER_LABEL = "New session started";

function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case "reset":
      return { messages: [], status: "idle" };
    case "loadHistory":
      return { messages: action.messages, status: "idle" };
    case "appendMessages":
      return { ...state, messages: [...state.messages, action.userMsg, action.asst] };
    case "appendDivider":
      return { ...state, messages: [...state.messages, action.divider] };
    case "updateLast": {
      const ms = state.messages;
      if (!ms.length) return state;
      const copy = ms.slice();
      copy[copy.length - 1] = action.fn(copy[copy.length - 1]);
      return { ...state, messages: copy };
    }
    case "setStatus":
      return { ...state, status: action.status };
  }
}

type ThreadRow = { role: "user" | "assistant" | "system" | "divider"; text: string; at: number };

function threadToMessages(rows: ThreadRow[]): ChatMessage[] {
  // Map the gateway-stitched thread to render rows. `divider` rows mark session
  // boundaries; user/assistant rows become bubbles; anything else is dropped (the
  // server already display-normalized control/bootstrap rows).
  const out: ChatMessage[] = [];
  let i = 0;
  for (const r of rows) {
    if (r.role === "divider") {
      out.push({ id: `divider-${++i}`, role: "assistant", blocks: [], divider: r.text || DIVIDER_LABEL });
      continue;
    }
    if (r.role !== "user" && r.role !== "assistant") continue;
    if (!r.text || r.text.trim().length === 0) continue;
    out.push({ id: `h-${++i}-${r.at}`, role: r.role, blocks: [{ kind: "text", md: r.text }] });
  }
  return out;
}

export function useChat(sessionId: string, onTurnComplete?: () => void) {
  const [{ messages, status }, dispatch] = useReducer(chatReducer, { messages: [], status: "idle" });
  const abortRef = useRef<AbortController | null>(null);
  // The chain member new turns target. The agent owns a chain of app sessions
  // (one per /new); this tracks the active (newest) one, refreshed from the
  // stitched thread and rotated forward on /new.
  const activeIdRef = useRef<string>(sessionId);
  const idRef = useRef(0);
  const newId = () => `m-${++idRef.current}`;
  const agentId = familyAgentId(sessionId);

  // Abort in-flight stream on unmount
  useEffect(() => () => { abortRef.current?.abort(); }, []);

  // Fetch the agent's full stitched thread (every chain member + dividers) and
  // remember the active session. Used on open and after /new.
  const loadThread = useCallback(async (signal?: { cancelled: boolean }) => {
    if (!agentId) return;
    try {
      const r = await fetch(`/api/agents/${encodeURIComponent(agentId)}/thread`);
      if (!r.ok || signal?.cancelled) return;
      const j = await r.json() as { activeId?: string; messages?: ThreadRow[] };
      if (signal?.cancelled) return;
      if (j.activeId) activeIdRef.current = j.activeId;
      dispatch({ type: "loadHistory", messages: threadToMessages(j.messages ?? []) });
    } catch { /* keep buffer; status banner already covers errors */ }
  }, [agentId]);

  // Abort, reset, and load the thread when the agent/session changes.
  useEffect(() => {
    abortRef.current?.abort();
    dispatch({ type: "reset" });
    activeIdRef.current = sessionId;
    if (!sessionId) return;
    const sig = { cancelled: false };
    loadThread(sig);
    return () => { sig.cancelled = true; };
  }, [sessionId, loadThread]);

  const updateLast = useCallback((fn: (m: ChatMessage) => ChatMessage) => {
    dispatch({ type: "updateLast", fn });
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
    } else if (event === "replace") {
      const text = String(d.text ?? "");
      updateLast((m) => {
        const blocks: Block[] = m.blocks.filter((b) => b.kind !== "text");
        if (text.length > 0) blocks.push({ kind: "text", md: text });
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
      dispatch({ type: "setStatus", status: "idle" });
      onTurnComplete?.();
    } else if (event === "error") {
      updateLast((m) => ({ ...m, error: String(d.message ?? "stream error") }));
      dispatch({ type: "setStatus", status: "error" });
    }
  }, [updateLast, onTurnComplete]);

  // "/new" — mint a genuinely fresh (zero-context) session for this agent. Prior
  // sessions stay listed and are stitched above a "New session started" divider;
  // new turns target the new member. The command isn't echoed as a bubble.
  const newSession = useCallback(async () => {
    if (!agentId) return;
    try {
      const r = await fetch(`/api/agents/${encodeURIComponent(agentId)}/new`, { method: "POST" });
      if (!r.ok) return;
      const j = await r.json() as { id?: string };
      if (j.id) activeIdRef.current = j.id; // new turns target the fresh session
    } catch { return; /* leave the thread untouched if the create failed */ }
    // Append the boundary in place — keeping the already-loaded (normalized) prior
    // sessions above. We don't re-fetch the thread here: a brand-new session has no
    // transcript yet and may not be listed, which would wipe this divider. On the
    // next open/reload getAgentThread reconstructs the chain from the gateway.
    dispatch({ type: "appendDivider", divider: { id: `divider-live-${newId()}`, role: "assistant", blocks: [], divider: DIVIDER_LABEL } });
  }, [agentId]);

  const send = useCallback(async (text: string) => {
    if (/^\/new(\s|$)/i.test(text.trim())) { await newSession(); return; }
    const userMsg: ChatMessage = { id: newId(), role: "user", blocks: [{ kind: "text", md: text }] };
    const asst: ChatMessage = { id: newId(), role: "assistant", blocks: [] };
    dispatch({ type: "appendMessages", userMsg, asst });
    dispatch({ type: "setStatus", status: "streaming" });

    const ac = new AbortController();
    abortRef.current = ac;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId: activeIdRef.current, text }),
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
  }, [handleEvent, newSession]);

  return { messages, status, send };
}
