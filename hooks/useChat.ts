"use client";
import { useCallback, useEffect, useReducer, useRef } from "react";
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

type ChatState = { messages: ChatMessage[]; status: Status };
type ChatAction =
  | { type: "reset" }
  | { type: "appendMessages"; userMsg: ChatMessage; asst: ChatMessage }
  | { type: "updateLast"; fn: (m: ChatMessage) => ChatMessage }
  | { type: "setStatus"; status: Status };

function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case "reset":
      return { messages: [], status: "idle" };
    case "appendMessages":
      return { ...state, messages: [...state.messages, action.userMsg, action.asst] };
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

export function useChat(sessionId: string) {
  const [{ messages, status }, dispatch] = useReducer(chatReducer, { messages: [], status: "idle" });
  const abortRef = useRef<AbortController | null>(null);
  const idRef = useRef(0);
  const newId = () => `m-${++idRef.current}`;

  // Abort in-flight stream on unmount
  useEffect(() => () => { abortRef.current?.abort(); }, []);

  // Abort and reset when sessionId changes
  useEffect(() => {
    abortRef.current?.abort();
    dispatch({ type: "reset" });
  }, [sessionId]);

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
    } else if (event === "error") {
      updateLast((m) => ({ ...m, error: String(d.message ?? "stream error") }));
      dispatch({ type: "setStatus", status: "error" });
    }
  }, [updateLast]);

  const send = useCallback(async (text: string) => {
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
