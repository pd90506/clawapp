const PALETTE = [
  "#4a6b8a", "#7a8a4a", "#8a4a6b", "#6b4a8a",
  "#8a6b4a", "#4a8a8a", "#8a4a4a", "#4a8a4a",
];

function hash(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h) + s.charCodeAt(i);
  return Math.abs(h);
}

export function agentVisual(agentId: string): { color: string; initial: string } {
  const color = PALETTE[hash(agentId) % PALETTE.length];
  const initial = (agentId[0] ?? "?").toUpperCase();
  return { color, initial };
}

// Pull the agent id out of a session key. The gateway namespaces created keys as
// `agent:<id>:app:<id>`, but a freshly-created session can still surface in the
// bare `app:<id>` form — match both so the chat resolves the agent (and its
// name/avatar) either way instead of falling back to "Assistant".
export function agentIdFromSessionKey(key: string | null): string | null {
  if (!key) return null;
  return key.match(/^agent:([^:]+):/)?.[1] ?? key.match(/^app:([^:]+)$/)?.[1] ?? null;
}
