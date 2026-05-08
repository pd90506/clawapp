import { describe, it, expect } from "vitest";
import { parseSseChunks } from "./sseParse";

describe("parseSseChunks", () => {
  it("yields complete frames split across chunks", () => {
    const out: { event: string; data: string }[] = [];
    const push = (f: { event: string; data: string }) => out.push(f);
    const p = parseSseChunks(push);
    p.feed("event: token\ndata: ");
    p.feed('{"type":"token","text":"hi"}\n\nevent: done\ndata: {"type":"done"}\n\n');
    expect(out).toEqual([
      { event: "token", data: '{"type":"token","text":"hi"}' },
      { event: "done", data: '{"type":"done"}' },
    ]);
  });
  it("ignores frames without event/data", () => {
    const out: { event: string; data: string }[] = [];
    const p = parseSseChunks((f) => out.push(f));
    p.feed(": comment\n\nevent: x\n\n");
    expect(out).toEqual([]);
  });
});
