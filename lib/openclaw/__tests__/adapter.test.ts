import { describe, it, expect } from "vitest";
import { adaptTranscriptEvent, initialAdapterState, type AdapterState } from "../adapter";
import type { TranscriptEvent } from "../events";

function chatEvent(state: "delta" | "final" | "error" | "aborted", text: string, opts: Partial<{ runId: string; seq: number; errorMessage: string }> = {}): TranscriptEvent {
  return {
    kind: "chat",
    data: {
      runId: opts.runId ?? "r1",
      sessionKey: "s1",
      seq: opts.seq ?? 0,
      state,
      message: state === "error" || state === "aborted"
        ? undefined
        : { role: "assistant", content: [{ type: "text", text }], timestamp: 1 },
      errorMessage: opts.errorMessage,
    } as never,
  };
}

function chatV4Delta(deltaText: string, opts: Partial<{ runId: string; replace: boolean }> = {}): TranscriptEvent {
  return {
    kind: "chat",
    data: {
      runId: opts.runId ?? "r1",
      sessionKey: "s1",
      seq: 0,
      state: "delta",
      deltaText,
      replace: opts.replace,
    } as never,
  };
}

function toolEvent(phase: "start" | "result", opts: { id?: string; name?: string; args?: unknown; result?: unknown; isError?: boolean; meta?: string } = {}): TranscriptEvent {
  return {
    kind: "tool",
    data: {
      runId: "r1",
      seq: 0,
      stream: "tool",
      ts: 1,
      sessionKey: "s1",
      data: {
        phase,
        name: opts.name ?? "search",
        toolCallId: opts.id ?? "t1",
        args: opts.args,
        result: opts.result,
        isError: opts.isError,
        meta: opts.meta,
      },
    } as never,
  };
}

function sessionMessage(role: string, text: string): TranscriptEvent {
  return {
    kind: "message",
    data: {
      sessionKey: "s1",
      message: { role, content: [{ type: "text", text }], timestamp: 1 },
    } as never,
  };
}

function run(events: TranscriptEvent[], state: AdapterState = initialAdapterState()): unknown[] {
  const out: unknown[] = [];
  for (const e of events) {
    const r = adaptTranscriptEvent(e, state);
    out.push(...r.out);
    state = r.next;
  }
  return out;
}

describe("adapter.adaptTranscriptEvent", () => {
  it("maps chat delta events to incremental token events", () => {
    const out = run([
      chatEvent("delta", "he"),
      chatEvent("delta", "hello"),
      chatEvent("delta", "hello!"),
    ]);
    expect(out).toEqual([
      { type: "token", text: "he" },
      { type: "token", text: "llo" },
      { type: "token", text: "!" },
    ]);
  });

  it("emits remaining text + done on chat final", () => {
    const out = run([
      chatEvent("delta", "hello"),
      chatEvent("final", "hello world"),
    ]);
    expect(out).toEqual([
      { type: "token", text: "hello" },
      { type: "token", text: " world" },
      { type: "done" },
    ]);
  });

  it("uses protocol v4 deltaText directly for incremental chat tokens", () => {
    const out = run([
      chatV4Delta("he"),
      chatV4Delta("llo"),
      chatEvent("final", "hello"),
    ]);
    expect(out).toEqual([
      { type: "token", text: "he" },
      { type: "token", text: "llo" },
      { type: "done" },
    ]);
  });

  it("maps protocol v4 replacement deltas to replace events", () => {
    const out = run([
      chatV4Delta("helo"),
      chatV4Delta("hello", { replace: true }),
    ]);
    expect(out).toEqual([
      { type: "token", text: "helo" },
      { type: "replace", text: "hello" },
    ]);
  });

  it("maps non-prefix v3 cumulative snapshots to replace events", () => {
    const out = run([
      chatEvent("delta", "helo"),
      chatEvent("delta", "hello"),
    ]);
    expect(out).toEqual([
      { type: "token", text: "helo" },
      { type: "replace", text: "hello" },
    ]);
  });

  it("emits done with no extra token when final text matches last delta", () => {
    const out = run([
      chatEvent("delta", "done"),
      chatEvent("final", "done"),
    ]);
    expect(out).toEqual([
      { type: "token", text: "done" },
      { type: "done" },
    ]);
  });

  it("maps chat error to error event", () => {
    const out = run([
      chatEvent("error", "", { errorMessage: "boom" }),
    ]);
    expect(out).toEqual([{ type: "error", message: "boom" }]);
  });

  it("maps chat aborted to error event with 'aborted' message", () => {
    const out = run([
      chatEvent("aborted", ""),
    ]);
    expect(out).toEqual([{ type: "error", message: "aborted" }]);
  });

  it("maps tool start to tool_call", () => {
    const out = run([toolEvent("start", { id: "t1", name: "search", args: { q: "x" } })]);
    expect(out).toEqual([{ type: "tool_call", id: "t1", name: "search", args: { q: "x" } }]);
  });

  it("maps tool result (success) to tool_result", () => {
    const out = run([toolEvent("result", { id: "t1", result: "ok" })]);
    expect(out).toEqual([{ type: "tool_result", id: "t1", result: "ok" }]);
  });

  it("maps tool result with isError to tool_result with error", () => {
    const out = run([toolEvent("result", { id: "t1", isError: true, meta: "tool failed" })]);
    expect(out).toEqual([{ type: "tool_result", id: "t1", error: "tool failed" }]);
  });

  it("uses assistant session.message events as a final text fallback", () => {
    const out = run([
      sessionMessage("assistant", "hello after thinking"),
      chatEvent("final", ""),
    ]);
    expect(out).toEqual([
      { type: "replace", text: "hello after thinking" },
      { type: "done" },
    ]);
  });

  it("does not duplicate text when a non-empty chat final follows session.message fallback", () => {
    const out = run([
      sessionMessage("assistant", "hello after thinking"),
      chatEvent("final", "hello after thinking"),
    ]);
    expect(out).toEqual([
      { type: "replace", text: "hello after thinking" },
      { type: "done" },
    ]);
  });

  it("ignores non-assistant session.message events", () => {
    const out = run([sessionMessage("user", "hello")]);
    expect(out).toEqual([]);
  });

  it("tracks per-runId text separately", () => {
    const out = run([
      chatEvent("delta", "run1: hi", { runId: "r1" }),
      chatEvent("delta", "run2: ye", { runId: "r2" }),
      chatEvent("delta", "run1: hi there", { runId: "r1" }),
      chatEvent("delta", "run2: yes", { runId: "r2" }),
    ]);
    expect(out).toEqual([
      { type: "token", text: "run1: hi" },
      { type: "token", text: "run2: ye" },
      { type: "token", text: " there" },
      { type: "token", text: "s" },
    ]);
  });
});
