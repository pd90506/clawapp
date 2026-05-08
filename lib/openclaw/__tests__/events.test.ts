import { describe, it, expect } from "vitest";
import { parseStreamEvent, parseTranscriptEvent } from "../events";

describe("parseStreamEvent", () => {
  it("parses token event", () => {
    const e = parseStreamEvent({ type: "token", text: "hi" });
    expect(e).toEqual({ type: "token", text: "hi" });
  });
  it("parses tool_call event", () => {
    const e = parseStreamEvent({ type: "tool_call", id: "t1", name: "search", args: { q: "x" } });
    expect(e?.type).toBe("tool_call");
  });
  it("parses tool_result event", () => {
    const e = parseStreamEvent({ type: "tool_result", id: "t1", result: "ok" });
    expect(e?.type).toBe("tool_result");
  });
  it("parses thinking event", () => {
    const e = parseStreamEvent({ type: "thinking", text: "hmm" });
    expect(e?.type).toBe("thinking");
  });
  it("parses done event", () => {
    expect(parseStreamEvent({ type: "done" })).toEqual({ type: "done" });
  });
  it("parses error event", () => {
    expect(parseStreamEvent({ type: "error", message: "boom" })).toEqual({ type: "error", message: "boom" });
  });
  it("returns null on unknown shape", () => {
    expect(parseStreamEvent({ type: "wat" })).toBeNull();
    expect(parseStreamEvent("not an object")).toBeNull();
  });
});

describe("parseTranscriptEvent", () => {
  it("parses a session.message event with content array", () => {
    const e = parseTranscriptEvent("session.message", {
      sessionKey: "s1",
      message: { role: "assistant", content: [{ type: "text", text: "hello" }], timestamp: 1 },
      messageSeq: 5,
    });
    expect(e?.kind).toBe("message");
    if (e?.kind === "message") {
      expect(e.data.sessionKey).toBe("s1");
      expect(e.data.message.role).toBe("assistant");
    }
  });

  it("parses a session.message with string content", () => {
    const e = parseTranscriptEvent("session.message", {
      sessionKey: "s1",
      message: { role: "user", content: "hi", timestamp: 1 },
    });
    expect(e?.kind).toBe("message");
  });

  it("parses a session.tool start event", () => {
    const e = parseTranscriptEvent("session.tool", {
      runId: "r1",
      seq: 0,
      stream: "tool",
      ts: 1,
      sessionKey: "s1",
      data: { phase: "start", name: "search", toolCallId: "t1", args: { q: "x" } },
    });
    expect(e?.kind).toBe("tool");
    if (e?.kind === "tool") {
      expect(e.data.data.phase).toBe("start");
      expect(e.data.data.toolCallId).toBe("t1");
    }
  });

  it("parses a session.tool result event with isError", () => {
    const e = parseTranscriptEvent("session.tool", {
      runId: "r1",
      seq: 1,
      stream: "tool",
      ts: 2,
      sessionKey: "s1",
      data: { phase: "result", name: "search", toolCallId: "t1", isError: false, result: "ok" },
    });
    expect(e?.kind).toBe("tool");
  });

  it("parses a chat delta event", () => {
    const e = parseTranscriptEvent("chat", {
      runId: "r1",
      sessionKey: "s1",
      seq: 1,
      state: "delta",
      message: { role: "assistant", content: [{ type: "text", text: "hello" }], timestamp: 1 },
    });
    expect(e?.kind).toBe("chat");
    if (e?.kind === "chat") {
      expect(e.data.state).toBe("delta");
    }
  });

  it("parses a chat final event", () => {
    const e = parseTranscriptEvent("chat", {
      runId: "r1",
      sessionKey: "s1",
      seq: 5,
      state: "final",
      message: { role: "assistant", content: [{ type: "text", text: "hello world" }], timestamp: 1 },
    });
    expect(e?.kind).toBe("chat");
  });

  it("parses a chat error event", () => {
    const e = parseTranscriptEvent("chat", {
      runId: "r1",
      sessionKey: "s1",
      seq: 2,
      state: "error",
      errorMessage: "boom",
      errorKind: "timeout",
    });
    expect(e?.kind).toBe("chat");
    if (e?.kind === "chat") {
      expect(e.data.state).toBe("error");
      expect(e.data.errorMessage).toBe("boom");
    }
  });

  it("returns null for unknown event names", () => {
    expect(parseTranscriptEvent("session.unknown", {})).toBeNull();
  });

  it("returns null for malformed payload", () => {
    expect(parseTranscriptEvent("session.message", "not an object")).toBeNull();
    expect(parseTranscriptEvent("session.tool", { sessionKey: "s1" })).toBeNull(); // missing data
  });
});
