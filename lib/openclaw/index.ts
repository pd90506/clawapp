import { loadConfig } from "./config";
import { createClient, type Client } from "./client";

let cached: Client | null | undefined;

export function getClient(): Client | null {
  if (cached === undefined) {
    const cfg = loadConfig();
    cached = cfg ? createClient(cfg) : null;
  }
  return cached;
}

export function __resetClientForTests() { cached = undefined; }

export type { SessionSummary, Message } from "./client";
export type { StreamEvent } from "./events";
