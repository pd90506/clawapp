import http from "node:http";
import { WebSocketServer } from "ws";

export async function startFakeGateway(port: number, token: string) {
  const server = http.createServer((req, res) => {
    if (req.headers.authorization !== `Bearer ${token}`) {
      res.statusCode = 401; res.end(); return;
    }
    if (req.url === "/health") { res.statusCode = 200; res.end("ok"); return; }
    if (req.url === "/sessions") {
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ sessions: [{ id: "s1", title: "Test" }] }));
      return;
    }
    if (req.url?.startsWith("/sessions/")) {
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ messages: [] }));
      return;
    }
    res.statusCode = 404; res.end();
  });
  const wss = new WebSocketServer({ server, path: "/chat" });
  wss.on("connection", (ws, req) => {
    if (req.headers.authorization !== `Bearer ${token}`) { ws.close(); return; }
    ws.on("message", () => {
      ws.send(JSON.stringify({ type: "token", text: "hello " }));
      ws.send(JSON.stringify({ type: "tool_call", id: "t1", name: "search", args: { q: "x" } }));
      ws.send(JSON.stringify({ type: "tool_result", id: "t1", result: "ok" }));
      ws.send(JSON.stringify({ type: "token", text: "world" }));
      ws.send(JSON.stringify({ type: "done" }));
    });
  });
  await new Promise<void>((res) => server.listen(port, "127.0.0.1", () => res()));
  return () => new Promise<void>((res) => server.close(() => res()));
}
