import { describe, it, expect } from "vitest";
import { parseFrame, makeRequest, makeId } from "../protocol";

describe("protocol frames", () => {
  it("parses a res frame", () => {
    const f = parseFrame({ type: "res", id: "1", ok: true, payload: { sessions: [] } });
    expect(f).toMatchObject({ type: "res", id: "1", ok: true });
  });
  it("parses an event frame", () => {
    const f = parseFrame({ type: "event", event: "session.message", payload: { x: 1 }, seq: 7 });
    expect(f).toMatchObject({ type: "event", event: "session.message", seq: 7 });
  });
  it("returns null on unknown shape", () => {
    expect(parseFrame({ type: "wat" })).toBeNull();
    expect(parseFrame("nope")).toBeNull();
  });
  it("makeRequest produces a req frame with stable shape", () => {
    const r = makeRequest("sessions.list", {});
    expect(r.type).toBe("req");
    expect(typeof r.id).toBe("string");
    expect(r.id.length).toBeGreaterThan(0);
    expect(r.method).toBe("sessions.list");
    expect(r.params).toEqual({});
  });
  it("makeId returns unique ids", () => {
    const a = makeId(); const b = makeId();
    expect(a).not.toBe(b);
  });
});
