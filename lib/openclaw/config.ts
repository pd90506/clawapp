import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export type GatewayConfig = {
  url: string;
  token: string;
  source: "file" | "env";
};

export function loadConfig(): GatewayConfig | null {
  // Env vars take precedence over file-based config.
  const url = process.env.OPENCLAW_GATEWAY_URL;
  const token = process.env.OPENCLAW_TOKEN;
  if (url && token) return { url, token, source: "env" };

  try {
    const raw = readFileSync(join(homedir(), ".openclaw", "openclaw.json"), "utf8");
    const parsed = JSON.parse(raw);
    const port = parsed?.gateway?.port;
    const fileToken = parsed?.gateway?.auth?.token;
    if (typeof port === "number" && typeof fileToken === "string" && fileToken.length > 0) {
      return { url: `http://127.0.0.1:${port}`, token: fileToken, source: "file" };
    }
  } catch {
    // no usable file config
  }
  return null;
}
