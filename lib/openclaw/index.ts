import { loadConfig } from "./config";
import { createClient, type Client } from "./client";

let cached: Client | null = null;

export function getClient(): Client | null {
  if (cached) return cached;
  const cfg = loadConfig();
  if (cfg) {
    cached = createClient(cfg);
    return cached;
  }
  return null;
}

export function __resetClientForTests() { cached = null; }

export type { SessionSummary, Message } from "./client";
export type { StreamEvent } from "./events";
