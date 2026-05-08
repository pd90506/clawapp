// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createClient } from "../client";
import { startFakeWs, type FakeServer } from "./fakeWsServer";

let server: FakeServer;
beforeEach(async () => { server = await startFakeWs(); });
afterEach(async () => { await server.close(); });

describe("client.sendMessage", () => {
  it("yields events received over websocket and ends on done", async () => {
    server.onConnection((ws, req) => {
      expect(req.headers.authorization).toBe("Bearer tok");
      ws.send(JSON.stringify({ type: "token", text: "he" }));
      ws.send(JSON.stringify({ type: "token", text: "llo" }));
      ws.send(JSON.stringify({ type: "done" }));
    });
    const c = createClient({ url: server.url.replace("ws://", "http://"), token: "tok", source: "file" });
    const events = [];
    for await (const e of c.sendMessage("s1", "hi")) events.push(e);
    expect(events).toEqual([
      { type: "token", text: "he" },
      { type: "token", text: "llo" },
      { type: "done" },
    ]);
  });

  it("emits a single error event when ws closes mid-stream", async () => {
    server.onConnection((ws) => {
      ws.send(JSON.stringify({ type: "token", text: "h" }));
      ws.close();
    });
    const c = createClient({ url: server.url.replace("ws://", "http://"), token: "tok", source: "file" });
    const events = [];
    for await (const e of c.sendMessage("s1", "hi")) events.push(e);
    expect(events.at(0)).toEqual({ type: "token", text: "h" });
    expect(events.at(-1)?.type).toBe("error");
  });

  it("ignores malformed events", async () => {
    server.onConnection((ws) => {
      ws.send("not json");
      ws.send(JSON.stringify({ type: "wat" }));
      ws.send(JSON.stringify({ type: "done" }));
    });
    const c = createClient({ url: server.url.replace("ws://", "http://"), token: "tok", source: "file" });
    const events = [];
    for await (const e of c.sendMessage("s1", "hi")) events.push(e);
    expect(events).toEqual([{ type: "done" }]);
  });
});
