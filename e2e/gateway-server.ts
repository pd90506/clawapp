/**
 * Standalone fake gateway process — started by Playwright's webServer config
 * so it's ready before the Next.js dev server boots.
 */
import { startFakeGateway } from "./fixtures/gateway";
import http from "node:http";

const PORT = Number(process.env.GATEWAY_PORT ?? 39789);
const TOKEN = process.env.GATEWAY_TOKEN ?? "test-token";

const stop = await startFakeGateway(PORT, TOKEN);

// Health probe endpoint so Playwright's webServer can wait for readiness.
const probe = http.createServer((_req, res) => { res.statusCode = 200; res.end("ok"); });
probe.listen(PORT + 1, "127.0.0.1", () => {
  process.stdout.write(`fake-gateway ready on ws://127.0.0.1:${PORT}\n`);
});

process.on("SIGTERM", async () => { await stop(); probe.close(); });
process.on("SIGINT", async () => { await stop(); probe.close(); process.exit(0); });
