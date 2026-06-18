import type { Client } from "./client";

const PROMPT_USER_CHARS = 400;
const PROMPT_ASST_CHARS = 400;
const SUMMARY_MAX_CHARS = 40;
const TIMEOUT_MS = 8_000;

/**
 * Generate a short chat title from the first turn by spawning an ephemeral
 * session, asking the agent for a 3-6 word title, then deleting the session.
 *
 * Returns null on failure/timeout — caller should fall back to a heuristic
 * (e.g. truncated user text).
 *
 * Cost note: each call inherits the agent's full system prompt (~30k tokens
 * for the default `main` agent). Consider caching/batching at higher layers
 * if this ends up being called frequently.
 */
export async function summarizeChatTitle(
  c: Client,
  userText: string,
  assistantText: string,
  signal?: AbortSignal,
): Promise<string | null> {
  const tempLabel = `__title-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  let session: { id: string } | null = null;
  try {
    session = await c.createSession({ label: tempLabel });
  } catch { return null; }

  const cleanup = () => { if (session) c.deleteSession(session.id).catch(() => undefined); };

  const prompt = [
    "Write a concise conversation title (3-6 words). Output the title only — no quotes, no punctuation at the end, no preamble, no explanation.",
    "",
    `User: ${userText.slice(0, PROMPT_USER_CHARS)}`,
    `Assistant: ${assistantText.slice(0, PROMPT_ASST_CHARS)}`,
  ].join("\n");

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), TIMEOUT_MS);
  signal?.addEventListener("abort", () => ac.abort(), { once: true });

  try {
    let out = "";
    for await (const ev of c.sendMessage(session.id, prompt, ac.signal)) {
      if (ev.type === "token") out += ev.text;
      else if (ev.type === "replace") out = ev.text;
      else if (ev.type === "done") break;
      else if (ev.type === "error") return null;
    }
    return normalizeTitle(out);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
    cleanup();
  }
}

function normalizeTitle(raw: string): string | null {
  // Take the first non-empty line; strip wrapping quotes, trailing punctuation, and excess whitespace.
  const firstLine = raw.split(/\r?\n/).map((s) => s.trim()).find((s) => s.length > 0);
  if (!firstLine) return null;
  const cleaned = firstLine
    .replace(/^["'`]+|["'`]+$/g, "")
    .replace(/[.!?:;,\s]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return null;
  return cleaned.slice(0, SUMMARY_MAX_CHARS);
}
