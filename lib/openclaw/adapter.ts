import type { StreamEvent, TranscriptEvent } from "./events";
import { extractMessageText } from "./events";

export type AdapterState = {
  /** Per-runId lastSeenText for computing chat-delta incremental. */
  runs: Record<string, string>;
  /** Last assistant text observed through session.message when no runId is available. */
  lastAssistantText?: string;
};

export function initialAdapterState(): AdapterState {
  return { runs: {} };
}

export function adaptTranscriptEvent(
  ev: TranscriptEvent,
  state: AdapterState,
): { out: StreamEvent[]; next: AdapterState } {
  if (ev.kind === "message") {
    if (ev.data.message.role !== "assistant") return { out: [], next: state };
    const text = extractMessageText(ev.data.message);
    if (!text) return { out: [], next: state };
    return { out: [{ type: "replace", text }], next: { ...state, lastAssistantText: text } };
  }

  if (ev.kind === "tool") {
    const d = ev.data.data;
    if (d.phase === "start") {
      return {
        out: [{ type: "tool_call", id: d.toolCallId, name: d.name, args: d.args }],
        next: state,
      };
    }
    // phase === "result"
    if (d.isError === true) {
      return {
        out: [{ type: "tool_result", id: d.toolCallId, result: undefined, error: d.meta ?? "tool error" }],
        next: state,
      };
    }
    return {
      out: [{ type: "tool_result", id: d.toolCallId, result: d.result }],
      next: state,
    };
  }

  // ev.kind === "chat"
  const c = ev.data;
  const runId = c.runId;
  const prev = state.runs[runId] ?? state.lastAssistantText ?? "";

  if (c.state === "error") {
    const message = c.errorMessage ?? c.errorKind ?? "error";
    const next = { runs: { ...state.runs } };
    delete next.runs[runId];
    return { out: [{ type: "error", message }], next };
  }
  if (c.state === "aborted") {
    const next = { runs: { ...state.runs } };
    delete next.runs[runId];
    return { out: [{ type: "error", message: "aborted" }], next };
  }

  const snapshot = c.message ? extractMessageText(c.message as never) : "";
  const out: StreamEvent[] = [];

  let nextText: string;
  if (c.state === "delta" && typeof c.deltaText === "string") {
    if (c.replace) {
      out.push({ type: "replace", text: c.deltaText });
      nextText = c.deltaText;
    } else {
      if (c.deltaText.length > 0) out.push({ type: "token", text: c.deltaText });
      nextText = snapshot || prev + c.deltaText;
    }
  } else {
    if (prev.length > 0 && !snapshot.startsWith(prev)) {
      if (snapshot.length > 0) out.push({ type: "replace", text: snapshot });
    } else {
      const incremental = snapshot.slice(prev.length);
      if (incremental.length > 0) out.push({ type: "token", text: incremental });
    }
    nextText = snapshot;
  }

  if (c.state === "final") out.push({ type: "done" });

  const next = c.state === "final"
    ? (() => { const n = { runs: { ...state.runs } }; delete n.runs[runId]; return n; })()
    : { runs: { ...state.runs, [runId]: nextText } };

  return { out, next };
}
