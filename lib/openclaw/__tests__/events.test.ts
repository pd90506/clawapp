import { describe, it, expect } from "vitest";
import { parseStreamEvent } from "../events";

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
