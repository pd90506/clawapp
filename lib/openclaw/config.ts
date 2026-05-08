import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export type GatewayConfig = {
  url: string;
  token: string;
  source: "file" | "env";
};

export function loadConfig(): GatewayConfig | null {
  try {
    const raw = readFileSync(join(homedir(), ".openclaw", "openclaw.json"), "utf8");
    const parsed = JSON.parse(raw);
    const port = parsed?.gateway?.port;
    const token = parsed?.gateway?.auth?.token;
    if (typeof port === "number" && typeof token === "string" && token.length > 0) {
      return { url: `http://127.0.0.1:${port}`, token, source: "file" };
    }
  } catch {
    // fall through to env
  }
  const url = process.env.OPENCLAW_GATEWAY_URL;
  const token = process.env.OPENCLAW_TOKEN;
  if (url && token) return { url, token, source: "env" };
  return null;
}
