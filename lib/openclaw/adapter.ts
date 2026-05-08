import type { StreamEvent, TranscriptEvent } from "./events";
import { extractMessageText } from "./events";

export type AdapterState = {
  /** Per-runId lastSeenText for computing chat-delta incremental. */
  runs: Record<string, string>;
};

export function initialAdapterState(): AdapterState {
  return { runs: {} };
}

export function adaptTranscriptEvent(
  ev: TranscriptEvent,
  state: AdapterState,
): { out: StreamEvent[]; next: AdapterState } {
  if (ev.kind === "message") {
    // session.message events are transcript-file writes; chat events already
    // streamed the content. Ignore to avoid duplicate rendering.
    return { out: [], next: state };
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
  const prev = state.runs[runId] ?? "";

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

  const accumulated = c.message ? extractMessageText(c.message as never) : "";
  const incremental = accumulated.startsWith(prev) ? accumulated.slice(prev.length) : accumulated;
  const out: StreamEvent[] = [];
  if (incremental.length > 0) out.push({ type: "token", text: incremental });
  if (c.state === "final") out.push({ type: "done" });

  const next = c.state === "final"
    ? (() => { const n = { runs: { ...state.runs } }; delete n.runs[runId]; return n; })()
    : { runs: { ...state.runs, [runId]: accumulated } };

  return { out, next };
}
