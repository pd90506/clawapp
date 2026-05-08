import { WebSocketServer, type WebSocket } from "ws";
import type { AddressInfo } from "node:net";

export type FakeServer = {
  url: string;
  onConnection: (cb: (ws: WebSocket, req: { headers: Record<string, string> }) => void) => void;
  close: () => Promise<void>;
};

export async function startFakeWs(): Promise<FakeServer> {
  const wss = new WebSocketServer({ port: 0 });
  await new Promise<void>((res) => wss.once("listening", () => res()));
  const port = (wss.address() as AddressInfo).port;
  let handler: ((ws: WebSocket, req: { headers: Record<string, string> }) => void) | null = null;
  wss.on("connection", (ws, req) => {
    handler?.(ws, { headers: req.headers as Record<string, string> });
  });
  return {
    url: `ws://127.0.0.1:${port}`,
    onConnection: (cb) => { handler = cb; },
    close: () => new Promise((res) => wss.close(() => res())),
  };
}
